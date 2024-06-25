@echo off
echo Run Sunset Backup now...
echo =================================================================================================================
cmd /c node --env-file=.env %USERPROFILE%/Projects/philo/dist/downloadBackups.js
echo =================================================================================================================
echo Done. Press any key to close!
pause>nul
exit