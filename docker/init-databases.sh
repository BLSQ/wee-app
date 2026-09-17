#!/bin/sh
# Runs once, on first start of an empty data volume. POSTGRES_DB creates wee_app;
# the test database has to be created here.
set -e
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c 'CREATE DATABASE wee_app_test'
