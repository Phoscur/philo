@echo off
echo Run Sunset Backup now...
echo =================================================================================================================
cmd /c ts-node -r dotenv/config %USERPROFILE%/Projects/philo/src/lib/storage/downloadGithubRepos.ts
echo =================================================================================================================
echo Done. Press any key to close!
pause>nul
exit