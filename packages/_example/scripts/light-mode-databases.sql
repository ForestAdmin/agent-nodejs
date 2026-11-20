SELECT format('CREATE DATABASE %I', name)
FROM unnest(ARRAY['example_mysql', 'example_mssql', 'example_mariadb']) AS name
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = name)
\gexec
