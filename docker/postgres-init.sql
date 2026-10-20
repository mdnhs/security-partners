-- Runs once, when the dev Postgres volume is first created.
-- sp_dev comes from POSTGRES_DB; these are the test and E2E databases.
CREATE DATABASE sp_test;
CREATE DATABASE sp_e2e;
