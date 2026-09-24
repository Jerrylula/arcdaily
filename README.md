# Arc Daily · 主网签到

一个运行在 **Arc 主网**上的钱包签到项目。每个钱包每天可签到一次，项目不收取签到费用；用户只需支付 Arc 网络 Gas，以原生 USDC 结算。

项目包含 Solidity 合约、中文签到页面和浏览器钱包部署页面，使用 TypeScript、Vite 与 ethers v6，无需后端。支持累计签到、当前连续签到、最长连续签到和最近 7 天记录。

无需在自己电脑运行项目的上线方式，见 [GitHub + Cloudflare Pages 详细操作指南](./DEPLOY_GUIDE.md)。

## 网络与签到规则

| 配置 | 值 |
| --- | --- |
| 网络 | Arc Mainnet |
| Chain ID | `5042`（`0x13b2`） |
| RPC | `https://rpc.mainnet.arc.io` |
| 区块浏览器 | <https://explorer.arc.io> |
| 原生 Gas 货币 | USDC，18 位小数 |

网络参数来源：[Arc 官方连接文档](https://docs.arc.io/arc/references/connect-to-arc)。这里的 18 位小数用于原生货币 RPC 数值和钱包网络配置。

- 按链上区块时间计算 UTC 自然日，每天 `00:00 UTC`（北京时间 `08:00`）重置，不是签到后等待 24 小时。
- 同一钱包同一天只能成功签到一次。连续两天签到增加连续天数；漏签一天后再次签到从 1 开始。
- `checkIn()` 为 `nonpayable`，交易附带金额为 `0`。无需代币授权，也没有项目收款、提现、管理员、升级或奖励领取接口。
- 部署者支付一次合约部署 Gas，每位用户支付自己的签到 Gas。已上链的失败交易也可能消耗 Gas，最终费用以钱包和交易回执为准。

## 本地运行

需要 Node.js `>=20.9`（建议 Node.js 22 LTS）、npm，以及支持 Arc 主网的浏览器 EVM 钱包。

```powershell
npm ci
Copy-Item .env.example .env
npm run compile
npm run dev
```

打开终端显示的本地地址。`.env` 的可选配置如下：

```dotenv
VITE_ARC_RPC_URL=https://rpc.mainnet.arc.io
VITE_CHECKIN_CONTRACT_ADDRESS=
```

`VITE_` 变量会公开进入浏览器构建产物，只可填写公开配置。无需提供私钥或助记词，也不要把它们放入 `.env` 或客户端代码。

## 部署到 Arc 主网

1. 在钱包中准备足够支付部署 Gas 的 Arc 主网原生 USDC。
2. 打开本地站点的 `/deploy.html`，连接浏览器钱包，按页面提示切换至 Arc 主网。
3. 查看部署 Gas 估算，在钱包中确认合约部署交易。
4. 等待交易确认，复制合约地址。部署页面会在当前浏览器保存地址，可返回首页签到。
5. 若已有本项目合约，可在部署页面填写地址。页面会读取主网代码，并核对运行时字节码是否与当前构建完全一致。

部署和签到都需要用户在钱包中主动确认。**项目代码和部署页面已准备好，不代表合约已经部署到主网**；实际合约地址以成功部署的交易回执为准。

浏览器中保存的地址只对当前浏览器和站点来源生效。要让所有访问者使用同一个合约，将部署后的地址填入 `.env`：

```dotenv
VITE_ARC_RPC_URL=https://rpc.mainnet.arc.io
VITE_CHECKIN_CONTRACT_ADDRESS=你的主网合约地址
```

如果已经设置 `VITE_CHECKIN_CONTRACT_ADDRESS`，该配置优先于浏览器保存的地址。更换合约后请更新配置并重新构建。

随后构建并预览：

```powershell
npm run build
npm run preview
```

将 `dist/` 目录完整上传到支持 HTTPS 的静态网站托管服务，保留 `index.html` 和 `deploy.html` 两个入口，即可公开使用。修改环境变量后需要重新构建；本地开发时需要重启开发服务。

合约匹配会比较完整运行时字节码，包括编译元数据。使用其他源码、编译器版本或编译设置部署的合约会被拒绝。当前设置为 Solidity `0.8.30`、优化器 `200 runs`、EVM `paris`，无构造函数参数。

## 验证与目录

```powershell
npm test
npm run build
npm run test:ui
```

`npm test` 在本地 EVM 验证合约行为，不会发送主网交易。`npm run test:ui` 自动启动、关闭本地测试链和测试站点，并运行浏览器界面测试；测试钱包和交易均仅存在于本机。Windows 可使用已安装的 Microsoft Edge，也可通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指定 Chromium 浏览器可执行文件路径。截图写入 `test-results/`。构建和测试不等于独立安全审计。

| 路径 | 用途 |
| --- | --- |
| `contracts/ArcCheckIn.sol` | 签到合约 |
| `scripts/compile.mjs` | 固定编译设置并生成 ABI、字节码 |
| `src/` | 页面、钱包连接与链上读写 |
| `src/generated/ArcCheckIn.json` | 前端使用的编译产物 |
| `artifacts/ArcCheckIn.json` | 合约 ABI 与字节码 |
| `test/contract.test.mjs` | 合约测试 |
| `.env.example` | 公开配置示例 |

## 常见情况

- **没有合约地址：**先在部署页面部署合约，或使用本项目已部署的主网合约地址。
- **余额不足：**需要的是钱包在 Arc 主网上用于 Gas 的原生 USDC；其他网络的余额不能直接支付此处费用。
- **今天已签到：**以主网记录和 UTC 日期为准，等待下一个 UTC 自然日。
- **网络请求失败：**检查 RPC 与钱包网络。若交易已提交，先通过交易哈希在 [Arc 区块浏览器](https://explorer.arc.io) 查询结果。
- **合约代码不一致：**检查地址、网络、源码及编译设置，使用当前项目编译产物部署的合约。
