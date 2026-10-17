-- Prerequisites: cx_copilot.wisp_brand_links, cx_copilot.wisp_threads, and
-- cx_copilot.wisp_messages must exist with the schemas established for Wisp.

create or replace function cx_copilot.ingest_wisp_chat(
  p_site_id text,
  p_session_id text,
  p_platform text,
  p_message text,
  p_reply text,
  p_handoff boolean,
  p_page_url text,
  p_origin text,
  p_meta_data jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = cx_copilot, pg_catalog
as $$
declare
  v_brand_id uuid;
  v_thread_id uuid;
  v_platform text;
  v_now timestamptz := now();
  v_customer_meta jsonb;
  v_assistant_meta jsonb;
begin
  if coalesce(trim(p_site_id), '') = ''
    or coalesce(trim(p_session_id), '') = ''
    or coalesce(trim(p_message), '') = ''
    or coalesce(trim(p_reply), '') = '' then
    raise exception 'site_id, session_id, message, and reply are required';
  end if;

  v_platform := case when lower(coalesce(p_platform, '')) = 'shopify' then 'shopify' else 'web' end;

  select link.cx_brand_id
  into v_brand_id
  from cx_copilot.wisp_brand_links as link
  where link.site_id = p_site_id
    and link.enabled = true
  limit 1;

  if v_brand_id is null then
    raise exception 'No enabled Wisp brand mapping exists for site_id %', p_site_id;
  end if;

  v_customer_meta := coalesce(p_meta_data, '{}'::jsonb)
    || jsonb_build_object('page_url', p_page_url, 'origin', p_origin);
  v_assistant_meta := coalesce(p_meta_data, '{}'::jsonb)
    || jsonb_build_object('page_url', p_page_url, 'origin', p_origin, 'handoff', p_handoff);

  insert into cx_copilot.wisp_threads (
    brand_id,
    site_id,
    conversation_id,
    platform,
    provider,
    latest_message,
    latest_message_timestamp,
    latest_message_direction,
    last_message_preview,
    handoff,
    last_message_context,
    meta_data,
    last_activity_at,
    updated_at
  ) values (
    v_brand_id,
    p_site_id,
    p_session_id,
    v_platform,
    'wisp',
    p_reply,
    v_now + interval '1 microsecond',
    'outbound',
    left(p_reply, 500),
    p_handoff,
    jsonb_build_array(
      jsonb_build_object('role', 'customer', 'content', p_message, 'timestamp', v_now),
      jsonb_build_object('role', 'assistant', 'content', p_reply, 'timestamp', v_now + interval '1 microsecond')
    ),
    jsonb_build_object('page_url', p_page_url, 'origin', p_origin),
    v_now + interval '1 microsecond',
    v_now + interval '1 microsecond'
  )
  on conflict (brand_id, conversation_id, platform) do update
  set
    latest_message = excluded.latest_message,
    latest_message_timestamp = excluded.latest_message_timestamp,
    latest_message_direction = excluded.latest_message_direction,
    last_message_preview = excluded.last_message_preview,
    handoff = excluded.handoff,
    last_message_context = excluded.last_message_context,
    meta_data = excluded.meta_data,
    last_activity_at = excluded.last_activity_at,
    updated_at = excluded.updated_at
  returning id into v_thread_id;

  insert into cx_copilot.wisp_messages (
    thread_id,
    brand_id,
    site_id,
    conversation_id,
    platform,
    provider_source,
    role,
    direction,
    message_status,
    content,
    timestamp,
    meta_data
  ) values (
    v_thread_id,
    v_brand_id,
    p_site_id,
    p_session_id,
    v_platform,
    'wisp',
    'customer',
    'inbound',
    'received',
    p_message,
    v_now,
    v_customer_meta
  ), (
    v_thread_id,
    v_brand_id,
    p_site_id,
    p_session_id,
    v_platform,
    'wisp',
    'assistant',
    'outbound',
    'sent',
    p_reply,
    v_now + interval '1 microsecond',
    v_assistant_meta
  );

  return v_thread_id;
end;
$$;

revoke all on function cx_copilot.ingest_wisp_chat(text, text, text, text, text, boolean, text, text, jsonb)
from public, anon, authenticated;

grant execute on function cx_copilot.ingest_wisp_chat(text, text, text, text, text, boolean, text, text, jsonb)
to service_role;
