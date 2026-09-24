# 通过 GitHub 和 Cloudflare Pages 上线 Arc Daily

这份流程不需要在自己的电脑上启动项目或安装 Node.js。你只需使用浏览器上传源码、配置托管，并用钱包签名部署合约。

顺序是：上传源码 → 云端构建网页 → 在线部署合约 → 保存合约地址并再次构建。

## 1. 准备账号和文件

- 注册并登录 [GitHub](https://github.com/) 与 [Cloudflare](https://dash.cloudflare.com/)。
- 在浏览器安装并设置自己的 EVM 钱包，例如 MetaMask 或 Rabby。
- 使用整理好的 `deliverables/github-upload/` 目录，或解压 `deliverables/arc-daily-github-source.zip`。
- 上传的是解压后目录里的文件和子目录；GitHub 不会自动解压你上传的 ZIP。

源码目录第一层必须有 `package.json`、`package-lock.json`、`index.html`、`deploy.html`、`vite.config.ts`、`tsconfig.json`，以及 `src`、`contracts`、`public`、`scripts`、`test` 目录。不要把外层 `github-upload` 目录一起作为仓库的第一层。

整理好的目录已排除 `.git`、`node_modules`、`dist`、`artifacts`、测试截图及本地 `.env`。`.env.example` 是配置示例，可以上传。钱包私钥和助记词不需要上传或填写到托管平台。

## 2. 新建 GitHub 仓库

1. 打开 [新建仓库](https://github.com/new)。
2. Owner 选择自己的账号。
3. Repository name 填 `arc-daily-checkin`。
4. 可选 Private（私有源码）；Cloudflare Pages 也支持私有仓库。源码私有不影响网站公开访问。
5. 关闭自动创建 README；gitignore 和 License 选 None。项目已提供 README 和 `.gitignore`。
6. 点击 Create repository。

参考：[GitHub 新建仓库说明](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository)。

## 3. 上传源码并提交

1. 在空仓库页面点击 `uploading an existing file`。若已有文件，点 Add file → Upload files。
2. 在 Windows 文件管理器中进入 `github-upload` 文件夹，全选里面的文件与子文件夹，把它们拖进上传区域。必要时在文件管理器中打开“显示隐藏的项目”，确保 `.gitignore`、`.env.example` 一同上传。
3. 等待文件全部上传。确认 `package.json` 显示在根目录，而不是 `github-upload/package.json`。
4. 提交说明填写 `Initial Arc Daily project`。
5. 对于自己的全新仓库，选择提交到默认分支，通常名为 `main`，点击 Commit changes。若界面要求新分支或显示 Propose changes，则按提示创建 Pull Request 并合并到默认分支后再继续。
6. 返回仓库首页，确认能直接看到 `package.json`、`src`、`contracts`。

不要把整份原始工作区直接拖入上传区域：网页上传时不能依靠 `.gitignore` 自动替你过滤文件。整理后的上传目录已经过滤好。

参考：[GitHub 上传文件说明](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)。

## 4. 创建 Cloudflare Pages 项目

1. 登录 Cloudflare，进入 Workers & Pages。
2. 点击 Create application，选择 Pages，再选 Connect to Git 或 Import an existing Git repository。
3. 选择 GitHub，按页面提示授权 Cloudflare 访问刚创建的仓库。若有 Only select repositories，选择 `arc-daily-checkin` 即可。
4. 回到 Cloudflare，选择仓库并点击 Begin setup。
5. 按下表配置：

| 项目 | 值 |
| --- | --- |
| Project name | `arc-daily-checkin`，重名时自行加后缀 |
| Production branch | 刚才上传文件的默认分支，通常为 `main` |
| Framework preset | `None`，手动填写下面两项 |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | 留空，前提是 `package.json` 在仓库根目录 |

6. 在环境变量中添加：

| 变量名 | 值 |
| --- | --- |
| `NODE_VERSION` | `22` |
| `VITE_ARC_RPC_URL` | `https://rpc.mainnet.arc.io` |

第一次不要添加 `VITE_CHECKIN_CONTRACT_ADDRESS`，不要填写占位文字。真实合约地址会在部署合约后获得。不要设置 `NODE_ENV=production` 或禁用开发依赖安装，因为构建需要 Vite、TypeScript 和 Solidity 编译器。

7. 点击 Save and Deploy。Cloudflare 会安装依赖、编译合约与网页并发布静态文件，不会代你发送链上部署交易。
8. 等待部署显示 Success。打开平台实际分配的 `pages.dev` 生产网址，首页应显示“签到合约尚未配置”，这时属于正常状态。

本项目使用 Pages 构建，不需要填写 `wrangler deploy`。如果只看到 Deploy command 等 Workers 专用配置，返回并选择 Pages。

参考：[Pages Git 集成](https://developers.cloudflare.com/pages/get-started/git-integration/)、[构建配置](https://developers.cloudflare.com/pages/configuration/build-configuration/)、[Node.js 版本配置](https://developers.cloudflare.com/pages/configuration/build-image/)。

## 5. 在已上线的网页部署 Arc 合约

1. 用装有钱包扩展的浏览器打开刚获得的生产网址。
2. 点底部“项目设置”，或者在这个网址后添加 `/deploy.html`。
3. 点击“连接部署钱包”，选中要支付部署 Gas 的钱包。
4. 按页面提示切换到 Arc 主网；当前项目固定 Chain ID 为 `5042`，使用原生 USDC 支付 Gas。
5. 查看页面的部署费用预估。钱包必须有足够的 Arc 主网 USDC，其他链上的 USDC 不能直接支付这笔 Gas。
6. 勾选“我了解这是主网部署，会支付真实的 USDC Gas”。如果按钮先显示切换网络，先切换，再点击部署。
7. 点击“部署签到合约”，核对钱包中的网络与费用，然后确认。
8. 等待页面显示“合约已部署”，保存完整的 `0x` 开头合约地址。使用这个合约地址，不是钱包地址或交易哈希。

交易已提交时不要重复部署，先通过页面上的交易链接核对结果。只要网页继续使用相同合约，日后更新网页不需要重新部署合约。

## 6. 把地址配置给所有访问者

浏览器保存地址只对当前浏览器和同一个网站来源有效。必须完成下面的配置，其他访问者才能使用相同合约。

1. 回到 Cloudflare → Workers & Pages → 当前 Pages 项目。
2. 打开 Settings → Environment variables；部分界面显示为 Variables and Secrets。
3. 选择 Production（生产环境），添加文本变量：

| 变量名 | 值 |
| --- | --- |
| `VITE_CHECKIN_CONTRACT_ADDRESS` | 粘贴刚部署成功的完整合约地址 |

4. 保存。值不加引号、不加等号；它是公开地址，无需作为私钥保密。
5. 回到 Deployments，找到生产分支对应的部署，使用 Retry deployment / Redeploy 重新构建。
6. 如果没有重新部署入口，可在 GitHub 修改 README 的普通说明并提交到生产分支，触发一次新的构建。
7. 等待新部署成功，访问生产网址并刷新。环境变量是在构建时写入网页的，只保存变量而不重新构建不会生效。

参考：[Pages 构建环境变量](https://developers.cloudflare.com/pages/configuration/build-configuration/#environment-variables)。

## 7. 验证上线结果

1. 在未使用过这个网站的浏览器或无痕窗口打开生产网址，确认不再显示“签到合约尚未配置”。此项不需要连接钱包。
2. 点击页脚“签到合约”，确认跳转到自己刚部署的合约。
3. 在允许钱包扩展的正常浏览器窗口连接钱包，完成一次真实签到。
4. 确认页面显示“今日已签到”，累计次数增加，交易回执成功。
5. 同一钱包当天按钮应禁用；每日 UTC 00:00（北京时间 08:00）进入下一签到日。

部署者支付一次部署 Gas，每个签到用户支付自己的交易 Gas。项目不收签到费用。

## 常见问题

| 现象 | 排查方式 |
| --- | --- |
| Cloudflare 找不到 GitHub 仓库 | 检查登录账号，以及 Cloudflare GitHub 应用对该仓库的授权 |
| 无法选择生产分支 | 先在 GitHub 完成源码提交，确保默认分支已经存在 |
| 构建找不到 `package.json` | 确保文件在仓库根目录；如果多套了一层目录，需要调整 Root directory |
| 构建提示缺少 Vite、tsc 或 solc | 确保上传 package.json、package-lock.json，并安装开发依赖 |
| 页面提示合约未配置 | 检查生产环境地址变量；保存后重新构建，并访问生产网址 |
| 页面提示没有合约或代码不一致 | 检查是否把钱包地址/交易哈希误填为合约地址，确认是本项目部署的 Arc 主网合约 |
| 钱包余额不足 | 核对钱包当前网络和 Arc 主网原生 USDC 余额 |
| 网页更新后数据是否丢失 | 相同网络、相同合约地址下，签到记录仍在链上；更换合约会使用另一套记录 |

若构建失败，在部署详情展开 Build log，保存第一条具体错误。仅靠最后一行“构建失败”通常无法判断原因。
