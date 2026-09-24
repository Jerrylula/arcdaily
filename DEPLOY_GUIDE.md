# Arc Daily：更新 Cloudflare Workers 上的签到网站

本项目的 Arc 主网签到合约已经由项目方部署。公开网站只允许钱包连接、查询记录和签到；不提供部署新合约或切换合约的页面。所有访问者使用项目方在 Cloudflare 构建时指定的同一个合约。

## 1. 把修改后的源码提交到 GitHub

Cloudflare 已连接 [Jerrylula/arcdaily](https://github.com/Jerrylula/arcdaily) 的 `main` 分支。在 GitHub 仓库最外层应用本次源码变更：

- 删除 `deploy.html` 和 `src/deploy.ts`。
- 更新 `src/main.ts`、`src/config.ts`、`vite.config.ts`、`scripts/test-ui.mjs`、`README.md` 和本说明文件。

GitHub 仓库的 `package.json`、`package-lock.json`、`index.html` 及 `src/` 等目录仍应在仓库最外层。`node_modules/`、`dist/` 不需要上传。

## 2. 检查 Cloudflare 构建设置

在 Cloudflare 控制台打开 **Workers & Pages → arcdaily → Settings → Build**，核对：

| 字段 | 内容 |
| --- | --- |
| Root directory | `/` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy --assets ./dist --name arcdaily --compatibility-date 2025-09-09` |
| Production branch | `main` |

在同一页的 **Variables and secrets** 中选择 `Variable`，保留 `NODE_VERSION=22`，并设置：

| Variable name | Variable value |
| --- | --- |
| `VITE_CHECKIN_CONTRACT_ADDRESS` | 已部署签到合约的完整 `0x` 地址 |

值只填合约地址，不填钱包地址、交易哈希、引号或 `VITE_CHECKIN_CONTRACT_ADDRESS=` 前缀。这个公开地址须在 **Settings → Build** 中设置；`Settings → Variables & Secrets` 是运行时变量页面，不能代替本项目的构建变量。

## 3. 等待新的构建和部署

向 GitHub 的 `main` 分支提交上述源码变更后，Cloudflare 通常会自动构建并部署。进入 **Deployments → Recent builds → Go to build history** 查看新的 `main` 构建是否成功。构建变量在 `npm run build` 时写入静态网页；只保存变量或手动发布旧版本，不会更新网页中的合约地址。

如果自动构建没有开始，可在最新 `main` 构建记录旁点击 `…` → **Retry build**。避免使用上方 Version History 中的旧版本再次发布。

## 4. 检查公开网站

1. 在无痕窗口打开生产网址。页面底部应没有“项目设置”，且整个站点不提供 `/deploy.html` 部署页。
2. 点击页脚“签到合约”，核对 Arc 浏览器里的地址是项目方指定的合约。
3. 连接钱包，按提示切换 Arc 主网，完成一次签到。签到交易只需钱包支付 Arc 网络 Gas，项目不收费用。

如果页面显示“签到服务暂未开放”，检查 `VITE_CHECKIN_CONTRACT_ADDRESS` 是否在构建变量中正确填写，并确认保存后有一次新的成功构建。若连接钱包后提示合约代码不一致，检查地址是否属于本项目当前编译版本的 Arc 主网合约。
