// we want to stay below 5GB (warning limit) per backup (github repo) chunk,
// it seems to be a good idea to stay even lower with daily backups
// git repos are best kept below 1GB
// refs:
// - https://stackoverflow.com/questions/38768454/repository-size-limits-for-github-com
// - https://github.community/t/can-i-use-github-as-free-unlimited-cloud-storage-or-is-this-only-with-bitbucket-possible/1574/5

// 1. use the date for the new folder name, create new repo via api https://stackoverflow.com/questions/36753547/create-github-repository-from-api
// 2. save images to ./shots (daily named repo)
// 3. save vids & gifs (yearly named repo)
// 3. save metadata, git commit
// 4. clean up - delete folder (daily only)

