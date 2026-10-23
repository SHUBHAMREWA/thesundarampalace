# Backups

`age-recipients.txt` (to be added) holds the **public** key used by
`.github/workflows/backup.yml` to encrypt the nightly database dump.
The matching private key must never be committed or stored in GitHub.

Restore (into a fresh database, never straight into production):

```bash
age --decrypt -i sundaram-backup.key sundaram-YYYY-MM-DD.dump.age > restore.dump
pg_restore --no-owner --no-privileges --dbname "$RESTORE_DATABASE_URL" restore.dump
npx prisma migrate status
```

Record each restore drill in `docs/deployment.md` §7.
