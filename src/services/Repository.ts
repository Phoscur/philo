import { inject, injectable } from '@joist/di';
import { Git } from './Git.js';
import { Directory, FileSystem } from './FileSystem.js';
import { Logger } from './Logger.js';

export const PAGES_BRANCH = 'gh-pages';
export const README_FILE = 'README.md';
export const INDEX_FILE = 'index.html';
export const ANIMATION_FILE = 'timelapse.mp4';
export const ACTION_FOLDERS = ['.github', 'workflows'];
export const ACTION_MAIN_FILE = '.github/workflows/main.yml';
export const ACTION_NOTIFY_FILE = '.github/workflows/notification.yml';

// TODO? extract TelegramNotificationActionBuilder
const telegramToken = `${process.env.TELEGRAM_TOKEN}`;
const telegramChatId = `${process.env.TELEGRAM_CHAT_ID}`;

export class Repo {
  constructor(
    public readonly dir: Directory,
    public readonly logger: Logger,
    public readonly git: Git
  ) {}

  async upload(file: string) {
    await this.git.upload(this.dir.path, file);
  }

  async add(file: string, content: string) {
    if (await this.dir.exists(file)) {
      this.logger.log('File', file, 'exists already, skipping upload!');
      return;
    }
    await this.dir.save(file, Buffer.from(content, 'utf8'));
    await this.upload(file);
    return file;
  }

  async addReadme() {
    const author = this.git.author;
    this.logger.log('File', README_FILE, 'is being created - by', author.name);
    return this.add(README_FILE, readmeString(this.dir.path, author.name, author.email));
  }

  async addIndexHtml() {
    const author = this.git.author;
    this.logger.log('File', INDEX_FILE, 'is being created - by', author.name);
    return this.add(INDEX_FILE, indexString(this.dir.path, author.name, author.email));
  }

  async branchPages() {
    await this.git.branch(this.dir.path, PAGES_BRANCH);
    this.logger.log('Checked out branch:', PAGES_BRANCH);
  }

  async createActionsFolder() {
    return this.dir.mkdirp(ACTION_FOLDERS);
  }

  async makeTimelapsePage() {
    const files = await this.dir.list();
    const jpegs = files.filter((f) => f.endsWith('jpg'));
    // TODO? jic add & commit files again?

    this.logger.log('Creating timelapse page for', jpegs.length, 'images...');

    await this.addIndexHtml();
    await this.createActionsFolder();
    await this.addNotificationAction();
    await this.addFFMpegAction(jpegs);
  }

  async addFFMpegAction(fileNames: string[]) {
    if (!fileNames.length) {
      return '%01.jpg'; // instead of just failing here, we will pretend to have files named [1-9].jpg
    }
    const parts = fileNames[fileNames.length - 1].split('-');
    parts.pop(); // throw away the counting part
    const len = fileNames.length.toString().length;
    const jpegs = `${parts.join('-')}-%0${len}d.jpg`;
    this.logger.log('File', ACTION_MAIN_FILE, 'is being created - FFMpeg Command:', jpegs);
    return this.add(ACTION_MAIN_FILE, ffmpegActionString(jpegs));
  }

  async addNotificationAction() {
    const title = this.dir.path;
    const url = this.git.getPageUrl(title);

    // setup telegram secrets
    const success = await this.git.setActionSecret(title, 'TELEGRAM_TO', telegramChatId);
    this.logger.log('Set secret TELEGRAM_TO', success ? 'successfully' : 'failed');
    const sus = await this.git.setActionSecret(title, 'TELEGRAM_TOKEN', telegramToken);
    this.logger.log('Set secret TELEGRAM_TOKEN', sus ? 'successfully' : 'failed');

    this.logger.log('File', ACTION_NOTIFY_FILE, 'is being created - Url referenced:', url);
    return this.add(ACTION_NOTIFY_FILE, telegramNotifyActionString(title, url));
  }

  async checkPage(file: string) {
    return this.git.checkPage(this.dir.path, file);
  }

  async enablePages(iterations = 0, file = 'index.html', waitMS = 5000) {
    const repoName = this.dir.path;
    let pagesEnabled = await this.git.enablePages(repoName);
    this.logger.log('Enabling GH pages for', repoName, pagesEnabled ? 'was successful' : 'failed');
    if (!iterations) return pagesEnabled;
    for (let i = 0; i < iterations; i++) {
      this.logger.log(
        'Waiting for the Pages Pipeline',
        pagesEnabled ? '' : '(to be enabled)',
        '...'
      );
      await new Promise((r) => setTimeout(r, waitMS));
      if (!pagesEnabled) {
        pagesEnabled = await this.git.enablePages(repoName);
      }
      if (pagesEnabled && (await this.git.checkPage(repoName, file))) {
        return true;
      }
    }
  }
}

/**
 * Github Repository Control
 * - creates readme file
 * - creates action file
 * - push files
 */
@injectable()
export class Repository {
  #git = inject(Git);
  #fs = inject(FileSystem);
  #logger = inject(Logger);

  async #newRepo(name: string) {
    return new Repo(await this.#fs().createDirectory(name), this.#logger(), this.#git());
  }

  /**
   * New Repository via API & checkout
   */
  async create(name: string, privateFlag = true) {
    const git = this.#git();

    await git.createRepository(name, privateFlag);
    return this.checkout(name);
  }
  /**
   * Download an existing repository
   */
  async checkout(repo: string, skip = false) {
    if (!skip) await this.#git().checkout(repo);
    return this.#newRepo(repo);
  }
}

export function readmeString(title: string, name: string, email: string, content = '') {
  return `## ${title} by [${name}](mailto:${email})
  \nlicensed under Creative Commons: [![CC BY-NC-SA](https://licensebuttons.net/l/by-nc-sa/4.0/88x31.png)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
\n${content}\n`;
}

export function indexString(
  title: string,
  name: string,
  email: string,
  video = ANIMATION_FILE,
  content = ''
) {
  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta property="og:title" content="${title}" />
      <meta property="og:video" content="${video}" />
    </head>
    <body>
      <video width="1280" controls autoplay loop>
        <source src="${video}" type="video/mp4" />
        Your browser does not support HTML video.
      </video>
  
      <p>${title} by <a href="mailto:${email}">${name}</a>${content}</p>
      <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank">
        Share if you like, licensed under Creative Commons:
        <img src="https://licensebuttons.net/l/by-nc-sa/4.0/88x31.png" alt="CC BY-NC-SA" />
      </a>
    </body>
  </html>`;
}

export function ffmpegActionString(jpegs: string, output = ANIMATION_FILE) {
  const jobName = 'timelapse-page',
    framerate = 18,
    scaleHeight = 1296; // 2028 best
  return `name: "FFmpeg Timelapse"
\non:
  push:
  workflow_dispatch:
\n# Sets permissions of the GITHUB_TOKEN to allow deployment to GitHub Pages
permissions:
  contents: write
  pages: write
  id-token: write
\n# Allow one concurrent deployment
concurrency:
  group: "pages"
  cancel-in-progress: true
\njobs:
  ${jobName}:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    name: Timelapse
    steps:
      - uses: actions/checkout@v3
      - run: mkdir dist && cp index.html dist/index.html

      - name: Render with FFmpeg
        uses: FedericoCarboni/setup-ffmpeg@v1
        id: setup-ffmpeg
      - run: ffmpeg -i ${jpegs} -framerate ${framerate} -c:v libx264 -crf 28 -vf scale=${scaleHeight}:-1 -an ./dist/timelapse.mp4

      - name: Expose generated video as artifact
        uses: actions/upload-artifact@v2
        with:
          name: Timelapse
          path: ./dist/${output}

      - name: Release
        uses: softprops/action-gh-release@v1
        if: startsWith(github.ref, 'refs/tags/')
        with:
          files: ./dist/${output}
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}

      - name: Deploy 🚀
        uses: JamesIves/github-pages-deploy-action@v4
        with:
          folder: dist\n
`;
}

export function telegramNotifyActionString(title: string, url: string, video = ANIMATION_FILE) {
  const jobName = 'telegram-notify';
  return `name: "Telegram Notification"
\non:  
  workflow_run:
    workflows: [pages-build-deployment]
    types:
      - completed
  workflow_dispatch:
\n# Allow one concurrent deployment
\njobs:
  ${jobName}:
    runs-on: ubuntu-latest
    steps:
      - name: send notification
        uses: appleboy/telegram-action@master
        with:
          to: \${{ secrets.TELEGRAM_TO }}
          token: \${{ secrets.TELEGRAM_TOKEN }}
          format: markdown
          message: | 
            [Timelapse](${url}${video}) - [${title}](${url})
`;
}
