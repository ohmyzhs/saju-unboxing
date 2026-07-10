-- AI 프로바이더 폴백 라우팅 설정 (opencode-go 1순위 → openrouter 2순위)
-- {
--   "primary": "opencode" | "openrouter",
--   "opencode":   { "report_model": "glm-5.2", "chat_model": "deepseek-v4-flash" },
--   "openrouter": { "api_key": "...", "report_model": "...", "report_provider": "",
--                   "chat_model": "...", "chat_provider": "" }
-- }
alter table site_config add column if not exists ai_routing jsonb default '{}'::jsonb;

notify pgrst, 'reload schema';
