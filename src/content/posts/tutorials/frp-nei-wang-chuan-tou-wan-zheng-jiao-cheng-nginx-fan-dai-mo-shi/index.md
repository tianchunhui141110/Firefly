---
title: "FRP v0.68.0 内网穿透完整教程"
published: 2026-08-04
description: "文档版本：v1.0 | 适用 FRP 版本：v0.68.0 | 更新日期：2026-07-31"
tags: ["Nginx"]
category: "Nginx"
draft: false
lang: zh_CN
---

## Nginx 反代模式 | 域名 aaa.example.com | Linux服务器 + Windows内网80端口

> 文档版本：v1.0 | 适用 FRP 版本：v0.68.0 | 更新日期：2026-07-31

---

## 一、整体架构说明

```
用户浏览器
    ↓ 80/443端口
Linux服务器 Nginx (反向代理)
    ↓ 内部转发 127.0.0.1:8080
Linux服务器 frps (vhostHTTPPort=8080, bindPort=7000)
    ↓ 7000端口通信
Windows内网 frpc
    ↓
Windows 本地 80 端口 Web 服务
```

**关键特点**：
- frps 的 `vhostHTTPPort` 使用内部端口 8080，80 端口留给 Nginx
- frps 的 `vhostHTTPPort` 只监听 `127.0.0.1`，无需对外防火墙放行 8080
- Nginx 监听 80/443，负责转发请求到 frps 内部端口 + SSL 终止
- 防火墙只需放行：7000（frpc连接）、80/443（Nginx）

---

## 二、下载 FRP

### 下载地址
GitHub Release 页面：`https://github.com/fatedier/frp/releases`

### 下载包选择

| 机器 | 系统 | 下载包 |
|------|------|--------|
| 公网服务器 | Linux 64位 (x86_64/amd64) | `frp_0.68.0_linux_amd64.tar.gz` |
| 内网机器 | Windows 64位 | `frp_0.68.0_windows_amd64.zip` |

> 同一个压缩包里同时包含 `frps`（服务端）和 `frpc`（客户端）。

---

## 三、Linux 公网服务器端配置

### 步骤 1：上传并解压 FRP

```bash
# 上传 frp_0.68.0_linux_amd64.tar.gz 到服务器后执行
cd /usr/local
tar -zxvf frp_0.68.0_linux_amd64.tar.gz
mv frp_0.68.0_linux_amd64 frp
cd frp
```

### 步骤 2：编写 frps.toml 配置文件

> ⚠️ **注意**：FRP v0.68.0 推荐使用 **TOML/YAML/JSON** 格式，旧版 INI 已不再推荐！

创建配置文件：

```bash
vim /usr/local/frp/frps.toml
```

写入以下**完整可用配置**：

```toml
# ==========================================
# FRP 服务端配置 frps.toml (v0.68.0)
# Nginx 反代模式：vhostHTTPPort 内部使用 8080
# ==========================================

# ---------- 基础连接配置 ----------
# frpc 连接的监听地址（需要对外，所以 0.0.0.0）
bindAddr = "0.0.0.0"
# frpc 连接 frps 的端口（客户端配置与此一致）
bindPort = 7000

# ---------- HTTP 虚拟主机端口（Nginx 反代模式关键配置） ----------
# 代理监听地址：只允许本地回环访问，禁止外部直连 8080
proxyBindAddr = "127.0.0.1"
# HTTP 类型代理监听端口（Nginx 会把请求转发到此端口）
vhostHTTPPort = 8080
# HTTP ResponseHeader 超时时间（秒）
vhostHTTPTimeout = 60

# 如果后续需要 HTTPS 代理（Nginx 不做 SSL 终止场景），取消下行注释
# vhostHTTPSPort = 8443

# ---------- 鉴权配置（必须开启！） ----------
[auth]
# 鉴权方式：token 或 oidc，默认 token
method = "token"
# 附加鉴权范围（可选）：HeartBeats, NewWorkConns
# additionalScopes = ["HeartBeats", "NewWorkConns"]
# ⚠️ 令牌（必须替换为复杂随机字符串，客户端必须设置相同的值）
token = "123456"

# ---------- 控制台 / Dashboard 配置 ----------
# ⚠️ 要直接通过 IP:7500 外网访问：addr 改成 "0.0.0.0"
# ⚠️ 只通过 Nginx 反代访问：保持 "127.0.0.1"
[webServer]
addr = "0.0.0.0"
port = 7500
user = "admin"
password = "123456"

# 是否提供 Prometheus 监控接口（需要 webServer 启用）
# enablePrometheus = true

# ---------- 日志配置 ----------
[log]
# 日志文件路径，console 表示输出到终端
to = "./frps.log"
# 日志级别：trace, debug, info, warn, error
level = "info"
# 日志保留天数
maxDays = 7
# 禁用日志颜色（写文件时建议禁用）
# disablePrintColor = false

# ---------- 传输层配置（可选优化） ----------
[transport]
# 允许客户端设置的最大连接池大小
maxPoolCount = 5
# 心跳连接超时时间（秒）
heartbeatTimeout = 90
# 底层 TCP keepalive 间隔（秒），负数表示不启用
tcpKeepalive = 30
# TCP Multiplex 心跳检查间隔（秒）
# tcpMuxKeepaliveInterval = 60

# ---------- 其他服务端限制（可选） ----------
# 服务端返回详细错误信息给客户端
# detailedErrorsToClient = true
# 限制单个客户端最大同时存在的代理数，0 表示无限制
# maxPortsPerClient = 0
# 用户建立连接后等待客户端响应的超时时间（秒）
# userConnTimeout = 10
```

### 步骤 3：防火墙端口放行

**需要对外放行的端口**：

| 端口 | 协议 | 来源 | 用途 |
|------|------|------|------|
| 7000 | TCP | 0.0.0.0/0 | frpc → frps 通信端口 |
| 80 | TCP | 0.0.0.0/0 | Nginx HTTP 访问 |
| 443 | TCP | 0.0.0.0/0 | Nginx HTTPS 访问（如需） |
| 7500 | TCP | 0.0.0.0/0 | Dashboard 直接访问（addr=0.0.0.0 时需要） |

**不需要放行的端口**：8080（只监听本地回环）

#### CentOS / RHEL (firewalld)
```bash
firewall-cmd --permanent --add-port=7000/tcp
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --permanent --add-port=443/tcp
firewall-cmd --permanent --add-port=7500/tcp
firewall-cmd --reload
# 验证
firewall-cmd --list-ports
```

#### Ubuntu / Debian (ufw)
```bash
ufw allow 7000/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 7500/tcp
ufw reload
# 验证
ufw status
```

#### 使用 iptables
```bash
iptables -I INPUT -p tcp --dport 7000 -j ACCEPT
iptables -I INPUT -p tcp --dport 80 -j ACCEPT
iptables -I INPUT -p tcp --dport 443 -j ACCEPT
iptables -I INPUT -p tcp --dport 7500 -j ACCEPT
service iptables save
```

> ⚠️ **云服务器必须操作**：阿里云/腾讯云/华为云/AWS 等还需要在**云控制台安全组**里放行上述入方向端口！

### 步骤 4：前台启动测试（必须先做！）

```bash
cd /usr/local/frp
./frps -c ./frps.toml
```

**成功标志**（参考输出）：
```
2026/07/31 12:00:00 [I] [root.go:xxx] frps started successfully
2026/07/31 12:00:00 [I] [webserver.go:xxx] Dashboard listen on 0.0.0.0:7500
```

确认无误后，按 `Ctrl + C` 停止。

### 步骤 5：配置 systemd 服务（后台运行 + 开机自启）

创建 systemd 服务文件：

```bash
vim /etc/systemd/system/frps.service
```

写入内容：

```ini
[Unit]
Description = FRP Server (Nginx Proxy Mode for aaa.example.com)
After = network.target syslog.target network-online.target
Wants = network.target network-online.target

[Service]
Type = simple
# 工作目录
WorkingDirectory = /usr/local/frp
# 启动命令（必须使用绝对路径）
ExecStart = /usr/local/frp/frps -c /usr/local/frp/frps.toml
# 异常自动重启策略
Restart = always
# 重启间隔（秒）
RestartSec = 5s
# 启动超时
TimeoutStartSec = 30s

[Install]
WantedBy = multi-user.target
```

加载配置并启动：

```bash
# 重新加载 systemd 单元文件
systemctl daemon-reload

# 启动 frps 服务
systemctl start frps

# 设置开机自启
systemctl enable frps

# 查看运行状态（active (running) 表示正常）
systemctl status frps
```

**查看日志**：
```bash
# 实时查看 systemd 日志
journalctl -u frps -f

# 查看最近 100 行 frps 自身日志
tail -n 100 /usr/local/frp/frps.log

# 实时查看 frps 自身日志
tail -f /usr/local/frp/frps.log
```

### 步骤 6：配置 Nginx 反向代理（核心步骤）

找到 Nginx 配置目录（通常是以下其中之一）：
- `/etc/nginx/conf.d/` ← CentOS 常见
- `/etc/nginx/sites-available/` + `/etc/nginx/sites-enabled/` ← Debian/Ubuntu 常见

新建 FRP 专属配置文件：

```bash
vim /etc/nginx/conf.d/aaa.example.com.conf
```

写入以下**完整配置**（含 HTTP 反代 + Dashboard 反代 + 标准优化头）：

```nginx
# ==========================================
# Nginx 反向代理 FRP 配置
# 域名: aaa.example.com
# 后端: frps vhostHTTPPort = 127.0.0.1:8080
# ==========================================

# ---------- 主站点：HTTP 80 → frps:8080 ----------
server {
    listen 80;
    listen [::]:80;

    # ⚠️ 必须与 frpc 中 customDomains 完全一致
    server_name aaa.example.com;

    # 日志
    access_log  /var/log/nginx/aaa.example.com.access.log  main;
    error_log   /var/log/nginx/aaa.example.com.error.log   warn;

    # 大文件上传支持（按需调整，比如部署网盘时调大）
    client_max_body_size 1024m;

    # ---------- 核心反代配置 ----------
    location / {
        # ⚠️ 转发到 frps 的 vhostHTTPPort（必须与 frps.toml 一致）
        proxy_pass http://127.0.0.1:8080;

        # ========================================
        # ⚠️ 极其重要：必须正确转发 Host 头！
        # frps 依赖 Host 字段区分不同域名的代理，
        # 缺失或错误会直接导致 404 Not Found
        # ========================================
        proxy_set_header Host $host;

        # ---------- 真实客户端 IP 相关头 ----------
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;

        # ---------- WebSocket 支持（长连接场景必需） ----------
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # ---------- 超时设置 ----------
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        send_timeout 300s;

        # ---------- 其他优化 ----------
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_redirect off;
    }
}
```

**可选 - 启用 HTTPS（强烈推荐生产环境使用）**：

申请完 SSL 证书后，在上面的 server 块基础上增加或改为：

```nginx
# ---------- HTTP → HTTPS 强制跳转 ----------
server {
    listen 80;
    listen [::]:80;
    server_name aaa.example.com;
    return 301 https://$host$request_uri;
}

# ---------- HTTPS 443 主站点 ----------
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name aaa.example.com;

    # SSL 证书路径（根据实际路径修改）
    ssl_certificate     /etc/letsencrypt/live/aaa.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/aaa.example.com/privkey.pem;

    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # HSTS（可选，仅全站 HTTPS 时开启）
    # add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # 其他 location 配置（反代、Dashboard 等同上，保持不变）
    access_log  /var/log/nginx/aaa.example.com.access.log  main;
    error_log   /var/log/nginx/aaa.example.com.error.log   warn;
    client_max_body_size 1024m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_buffering off;
    }
}
```

### 步骤 7：验证并重载 Nginx

```bash
# 1. 检查 Nginx 配置语法（必须通过，否则不要重载！）
nginx -t

# 预期输出：
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# 2. 语法 OK 后重载（不中断现有连接）
nginx -s reload
# 或者
systemctl reload nginx

# 3. 确认 Nginx 正在监听 80
ss -tlnp | grep -E ':(80|443)'
# 或
netstat -tlnp | grep nginx
```

### 步骤 8：配置 DNS 域名解析

登录你的**域名 DNS 管理后台**（阿里云万网 / 腾讯云 DNSPod / Cloudflare / 华为云 等），添加如下解析记录：

| 记录类型 | 主机记录 | 记录值 | TTL | 备注 |
|----------|----------|--------|-----|------|
| **A 记录** | `aaa` | `你的公网服务器IP地址` | 600 或 默认 | 必配，子域名 |
| A 记录 | `@` | `你的公网服务器IP地址` | 600 或 默认 | 可选，根域名也想用时配 |

**DNS 生效验证**（本机 CMD / PowerShell / Linux Shell）：
```bash
# Windows
nslookup aaa.example.com
# 或 Linux / macOS
dig aaa.example.com +short
# 或通用
ping aaa.example.com
```

返回值等于你的服务器公网 IP 即解析成功。

> ⚠️ 如果使用 Cloudflare 等 CDN：**测试阶段请先切换到「仅 DNS (DNS only)」模式**，确认穿透成功后再开启 CDN 代理（橙色云）。

---

## 四、Windows 内网客户端配置

### 步骤 1：解压并准备目录

1. 将下载的 `frp_0.68.0_windows_amd64.zip` 解压
2. 移动到固定目录（避免误删），建议：
   ```
   C:\Program Files\frp\
   ```

最终目录结构：
```
C:\Program Files\frp\
├── frpc.exe              ← 客户端程序
├── frpc.toml             ← 客户端配置（下一步创建）
├── frpc_full.toml        ← 完整配置参考（解压自带，按需查阅）
├── frpc.toml             ← 我们自己创建的最简生产配置
├── frps.exe              ← Windows 上用不到，可删除
└── frps_full.toml        ← 服务端完整参考，可删除
```

### 步骤 2：编写 frpc.toml 客户端配置文件

在 `C:\Program Files\frp\` 目录下**新建文本文件**，改名为 `frpc.toml`（注意扩展名是 `.toml` 不是 `.txt`），写入以下内容：

```toml
# ==========================================
# FRP 客户端配置 frpc.toml (v0.68.0)
# 场景：穿透 Windows 本地 80 端口 Web 服务
# 域名：aaa.example.com
# ==========================================

# ---------- 连接服务端配置 ----------
# ⚠️ 替换为你的公网服务器公网 IP 地址
serverAddr = "123.123.123.123"
# frps 的 bindPort（必须与服务端 frps.toml 的 bindPort 一致）
serverPort = 7000

# 第一次连接失败是否立即退出（true 方便调试，生产建议 false + 重连）
loginFailExit = false

# ---------- 鉴权配置（⚠️ 必须与服务端 frps.toml 完全一致！） ----------
[auth]
method = "token"
token = "123456"
# additionalScopes = ["HeartBeats", "NewWorkConns"]  # 服务端开启了这里也要开

# ---------- 客户端 Admin WebServer（可选，本地管理面板） ----------
# 浏览器访问：http://127.0.0.1:7400
[webServer]
addr = "127.0.0.1"
port = 7400
user = "admin"
password = "123456"

# ---------- 日志配置 ----------
[log]
to = "./frpc.log"
level = "info"
maxDays = 7
# disablePrintColor = false

# ---------- 传输层配置（可选优化） ----------
[transport]
# 通信协议：tcp, kcp, quic, websocket, wss（Nginx 反代场景用 tcp 即可）
protocol = "tcp"
# 连接服务端超时（秒）
dialServerTimeout = 10
# 底层 TCP keepalive（秒）
dialServerKeepalive = 30
# 连接池大小（与服务端 maxPoolCount 协调）
poolCount = 1
# TCP Multiplex（默认启用）
tcpMux = true
# 心跳包间隔（秒），tcpMux 启用后可设为 -1
heartbeatInterval = 30
# 心跳超时（秒）
heartbeatTimeout = 90

# TLS 连接（v0.68.0 默认启用，提高通信安全性）
[transport.tls]
enable = true

# ---------- 其他客户端配置 ----------
# 可选：附加元数据（服务端插件用）
# [metadatas]
# location = "office-shanghai"
# device = "windows-pc-01"

# ==========================================
# 代理配置：穿透本地 80 端口的 Web 服务
# ==========================================
[[proxies]]
# 代理名称（唯一，可自定义，服务端 Dashboard 中显示）
name = "web-80"
# 代理类型：http（域名复用、虚拟主机支持）
type = "http"
# 是否启用该代理（默认 true，false 可临时禁用不删除配置）
# enabled = true
# 被代理的本地服务 IP（本机就是 127.0.0.1；要代理局域网其他机器填对应 IP）
localIP = "127.0.0.1"
# 被代理的本地服务端口（Windows 上跑的 Web 端口）
localPort = 80

# ---------- HTTP 代理域名配置（必须与 Nginx server_name 一致！） ----------
customDomains = ["aaa.example.com"]

# 可选：通过子路径路由（例如只代理 /api/*）
# locations = ["/"]

# 可选：给穿透的网站加 HTTP Basic Auth 访问密码
# httpUser = "website-viewer"
# httpPassword = "Viewer@Pass2026"

# 可选：修改转发给后端的 Host Header（默认是 $host，按需改）
# hostHeaderRewrite = "internal.dev.local"

# 可选：请求/响应 Header 操作
# [proxies.requestHeaders]
# set = { "X-From-Frp" = "true", "X-Frp-User" = "admin" }
# [proxies.responseHeaders]
# set = { "X-Proxy" = "frp-v0.68.0" }

# ---------- 传输加密与压缩（推荐开启） ----------
[proxies.transport]
# 压缩传输内容（文本类资源效果显著，二进制图片/视频效果一般）
useCompression = true
# 额外加密（已启用全局 TLS 时可不开，双重加密略吃 CPU 但更安全）
useEncryption = true
# 可选：带宽限流（例如限制 10MB/s，防止内网带宽被占满）
# bandwidthLimit = "10MB"
# bandwidthLimitMode = "client"  # client 或 server

# ---------- 健康检查（可选，推荐开启） ----------
# 本地服务异常时自动下线，恢复后自动上线
# [proxies.healthCheck]
# # 检查类型：tcp 或 http
# type = "http"
# # http 类型必填：健康检查的 PATH
# path = "/"
# # 检查间隔（秒）
# intervalSeconds = 15
# # 单次超时（秒）
# timeoutSeconds = 5
# # 连续失败多少次判定不健康
# maxFailed = 3

# ==========================================
# 扩展：如果还想穿透其他端口/服务，可以继续加 [[proxies]]
# 示例：穿透 Windows 远程桌面 3389（TCP 类型）
# ==========================================
# [[proxies]]
# name = "windows-rdp-3389"
# type = "tcp"
# localIP = "127.0.0.1"
# localPort = 3389
# remotePort = 13389   # 服务端对外开放的端口（防火墙放行 13389）
# 然后在另一台电脑 mstsc 连接：服务器IP:13389
```

### 步骤 3：确认本地 80 端口服务正常

**极其重要**：先确保 Windows 本机浏览器能访问到 Web 服务。

1. 在本机浏览器打开：`http://127.0.0.1` 或 `http://localhost`
2. 确认能看到你的网站内容
3. 如果打不开 → **穿透出去一定也打不开**，请先解决本地服务问题

**本机端口检查命令**（PowerShell）：
```powershell
# 查看 80 端口被哪个进程占用
netstat -ano | findstr :80

# 测试 80 端口连通性
Test-NetConnection 127.0.0.1 -Port 80
# TcpTestSucceeded : True 才是正常

# 查看 PID 对应的程序名
tasklist | findstr <上面查到的PID号>
```

### 步骤 4：前台启动 frpc 测试（必须先做！）

以**管理员身份**打开 PowerShell 或 CMD：

```powershell
# 进入 frp 目录
cd "C:\Program Files\frp"

# 前台启动（测试阶段推荐，可以直接看到错误）
.\frpc.exe -c .\frpc.toml
```

**成功标志**（参考输出）：

```
2026/07/31 12:00:00 [I] [service.go:xxx] [abc123xyz] login to server success, get run id [abc123xyz]
2026/07/31 12:00:00 [I] [proxy_manager.go:xxx] [abc123xyz] proxy added: [web-80]
2026/07/31 12:00:00 [I] [control.go:xxx] [abc123xyz] [web-80] start proxy success
```

出现上述三行即表示**客户端与服务端连接成功 + 代理注册成功**！

**常见错误与处理**：

| 错误信息 | 原因 | 解决方案 |
|----------|------|----------|
| `dial tcp x.x.x.x:7000: connect: connection timed out` | 7000 端口不通 | ① 云服务器安全组放行 TCP 7000 ② 服务器防火墙放行 7000 ③ 确认 serverAddr 是公网 IP |
| `authentication failed` | token 不一致 | 逐字检查 frps.toml 和 frpc.toml 的 `token` 是否完全相同（注意空格、大小写） |
| `login to server failed: no response from server` | 协议不匹配 | 检查 `transport.protocol` 是否是 tcp（一般不用改） |
| `dial tcp 127.0.0.1:80: connectex: No connection could be made` | 本地 80 端口没服务 | 先在本机浏览器打开 `http://127.0.0.1` 确认服务起来了 |
| `proxy conflict: proxy name [xxx] already exists` | 代理名重复 | 修改 `name = "web-80"` 换个唯一名称 |

### 步骤 5：外网访问验证测试

**用手机开 4G/5G 流量**（确保不在同一局域网 / 同一 Wi-Fi 下），浏览器访问：
```
http://aaa.example.com
```

**成功标志**：看到你 Windows 本机 80 端口部署的网站内容 🎉

**可选同时验证**：
- FRP Dashboard：`http://你的服务器IP:7500` 或 `http://aaa.example.com/_frp_dashboard/`
- 登录用 frps.toml 配置的用户名密码（默认 admin / 123456）
- 在 Dashboard 里可以看到：在线客户端数、已注册代理、流量统计、连接数等

> 💡 如果 Dashboard 进不去，检查：
> 1. `webServer.addr` 是否改为 `0.0.0.0`（直接访问场景）
> 2. 云安全组 + 防火墙是否放行 7500
> 3. `systemctl status frps` 确认服务在跑
> 4. `ss -tlnp | grep 7500` 确认监听正常
> 5. `grep -i dashboard /usr/local/frp/frps.log` 看启动日志

### 步骤 6：配置 Windows 系统服务（开机自启 + 后台运行）

前台测试通过后，必须配置成系统服务，否则关闭 CMD 窗口 frpc 就停了。推荐使用 **NSSM**（Non-Sucking Service Manager）—— 稳定、免费、无坑。

#### 6.1 下载 NSSM

官网：`https://nssm.cc/release/nssm-2.24.zip`

1. 下载后解压
2. 进入 `win64/` 目录（32 位系统用 `win32/`）
3. 复制 `nssm.exe` 到 `C:\Program Files\frp\` 目录

最终目录：
```
C:\Program Files\frp\
├── frpc.exe
├── frpc.toml
├── frpc.log
└── nssm.exe    ← 放在这里
```

#### 6.2 安装系统服务

以**管理员身份**打开 PowerShell：

```powershell
cd "C:\Program Files\frp"

# 安装服务（会弹出图形配置界面）
.\nssm.exe install FRPClient
```

图形界面按以下表格填写（**每项都要检查，漏了会起不来**）：

| 标签页 | 字段 | 填写内容 |
|--------|------|----------|
| **Application** | Path | `C:\Program Files\frp\frpc.exe` |
| Application | Startup directory | `C:\Program Files\frp` |
| Application | Arguments | `-c C:\Program Files\frp\frpc.toml` |
| **Details** | Display name | `FRP Client - aaa.example.com` |
| Details | Description | `FRP内网穿透客户端 - 域名 aaa.example.com` |
| Details | Startup type | `Automatic`（自动） |
| **Log on** | Log on as | 选择 `Local System account`，勾选 `Allow service to interact with desktop` |
| **Dependencies** | | 留空即可 |
| **I/O** | Output (stdout) | `C:\Program Files\frp\nssm_stdout.log` |
| I/O | Error (stderr) | `C:\Program Files\frp\nssm_stderr.log` |
| I/O | Input (stdin) | 留空 |
| **File rotation** | | 勾选 Rotate files，设置 7 天 10MB 限制（可选） |

确认无误后，点击 **Install service** 按钮。

#### 6.3 启动并验证服务

```powershell
cd "C:\Program Files\frp"

# 启动服务
.\nssm.exe start FRPClient
# 预期：FRPClient: START: 操作成功完成。

# 查看状态（预期 SERVICE_RUNNING）
.\nssm.exe status FRPClient

# 查看 frpc 日志（确认连接成功）
Get-Content "C:\Program Files\frp\frpc.log" -Tail 50
# 应该能看到 login to server success + start proxy success

# 可选：实时追日志
Get-Content "C:\Program Files\frp\frpc.log" -Tail 30 -Wait
```

#### 6.4 NSSM 常用命令速查

```powershell
cd "C:\Program Files\frp"

# 启动 / 停止 / 重启
.\nssm.exe start FRPClient
.\nssm.exe stop FRPClient
.\nssm.exe restart FRPClient

# 查看状态 / 暂停 / 继续
.\nssm.exe status FRPClient
.\nssm.exe pause FRPClient
.\nssm.exe continue FRPClient

# 修改配置（再次弹出图形界面）
.\nssm.exe edit FRPClient

# 卸载服务
.\nssm.exe remove FRPClient
# 静默卸载（不弹确认框）
.\nssm.exe remove FRPClient confirm
```

> 💡 **备用方案（不用 NSSM）**：可以用 Windows 「任务计划程序」创建「登录时 / 启动时」执行 `frpc.exe -c frpc.toml` 的任务，但稳定性和可控性不如 NSSM，不推荐生产使用。

---

## 五、完整验证流程图

按顺序逐一确认，任何一步失败都要先解决再继续：

```
✅ Step 1. DNS 解析生效
   └─ Windows/Linux 执行：ping aaa.example.com
   └─ 预期：返回 = 你的公网服务器 IP

✅ Step 2. Nginx 监听正常
   └─ Linux 执行：ss -tlnp | grep -E ':(80|443)'
   └─ 预期：nginx 进程正在监听 80 / 443

✅ Step 3. frps 服务运行
   └─ Linux 执行：systemctl status frps
   └─ 预期：active (running)

✅ Step 4. frps 监听全部必需端口
   └─ Linux 执行：ss -tlnp | grep frps
   └─ 预期：0.0.0.0:7000、127.0.0.1:8080、0.0.0.0:7500 都在

✅ Step 5. frpc 成功登录
   └─ Windows 查看 frpc.log
   └─ 预期：login to server success

✅ Step 6. frpc 代理注册成功
   └─ Windows 查看 frpc.log
   └─ 预期：[web-80] start proxy success

✅ Step 7. 本地服务正常
   └─ Windows 浏览器：http://127.0.0.1
   └─ 预期：网站正常显示

✅ Step 8. 终极验证：外网访问
   └─ 手机流量浏览器：http://aaa.example.com
   └─ 预期：🎉 显示内网网站内容
```

---

## 六、常用运维命令速查表

### 6.1 Linux 服务器端

```bash
# ---------- FRP 服务管理 ----------
systemctl start frps          # 启动
systemctl stop frps           # 停止
systemctl restart frps        # 重启
systemctl status frps         # 查看运行状态
systemctl enable frps         # 设置开机自启
systemctl disable frps        # 取消开机自启
systemctl is-active frps      # 快速判断是否在跑（active/inactive）

# ---------- FRP 日志查看 ----------
journalctl -u frps -f                 # 实时追 systemd 捕获的日志
journalctl -u frps -n 200 --no-pager  # 看最近 200 行（不分页）
tail -f /usr/local/frp/frps.log       # 实时追 frps 自身日志
tail -n 300 /usr/local/frp/frps.log   # 看最近 300 行
grep -iE "error|fail|warn" /usr/local/frp/frps.log  # 只看错误/警告

# ---------- Nginx 管理 ----------
nginx -t                        # 测试配置（改完配置必先跑！）
nginx -s reload                 # 平滑重载配置
nginx -s stop                   # 立即停止
nginx -s quit                   # 优雅停止（处理完现有请求）
systemctl reload nginx          # 同上重载
systemctl restart nginx         # 重启（会短暂中断）

# Nginx 日志
tail -f /var/log/nginx/aaa.example.com.access.log
tail -f /var/log/nginx/aaa.example.com.error.log
tail -f /var/log/nginx/error.log   # 全局错误日志

# ---------- 端口 / 进程检查 ----------
# 查看所有相关端口监听
ss -tlnp | grep -E ':(7000|80|8080|443|7500)'
# 等价
netstat -tlnp | grep -E ':(7000|80|8080|443|7500)'

# 查看 frps 进程
ps aux | grep frps | grep -v grep
pgrep -af frps

# 检查端口连通性（本机自测）
ss -tlnp | grep 7000          # frps 的 frpc 连接端口
curl -I http://127.0.0.1:8080 -H "Host: aaa.example.com"  # 直接打 frps
curl -I http://127.0.0.1      # 打 Nginx
curl -I http://127.0.0.1:7500 # 打 Dashboard

# ---------- 资源占用 ----------
# frps 内存 / CPU
top -p $(pgrep frps)
# 或者
htop -p $(pgrep frps)
```

### 6.2 Windows 客户端

```powershell
# 进入 frp 目录
Set-Location "C:\Program Files\frp"

# ---------- FRP 服务管理（NSSM） ----------
.\nssm.exe start FRPClient       # 启动
.\nssm.exe stop FRPClient        # 停止
.\nssm.exe restart FRPClient     # 重启
.\nssm.exe status FRPClient      # 状态
.\nssm.exe edit FRPClient        # 改配置（弹窗）

# ---------- 日志查看 ----------
# 查看最近 50 行
Get-Content ".\frpc.log" -Tail 50
# 实时跟踪
Get-Content ".\frpc.log" -Tail 30 -Wait
# 筛选错误
Get-Content ".\frpc.log" | Select-String -Pattern "error|fail|warn" -CaseSensitive:$false

# ---------- 端口 / 网络检查 ----------
# 本地 80 端口占用
netstat -ano | findstr :80
Get-NetTCPConnection -LocalPort 80 -ErrorAction SilentlyContinue

# 测试连接 frps 服务器（7000 端口）
Test-NetConnection -ComputerName "你的服务器IP" -Port 7000
# TcpTestSucceeded : True 才是通的

# 测试本地 80
Test-NetConnection 127.0.0.1 -Port 80

# frpc 进程检查
Get-Process -Name frpc -ErrorAction SilentlyContinue
tasklist | findstr frpc

# ---------- 客户端面板（如果 webServer 启用了） ----------
# 浏览器打开
# http://127.0.0.1:7400
```

---

## 七、常见问题排查 FAQ

### Q1. 访问 `http://aaa.example.com` 返回 **404 Not Found**

**原因**：frps 收到请求后，根据 Host 头找不到匹配的代理。

排查步骤：
1. **Nginx 丢失 Host 头**（90% 概率）
   - 检查 Nginx 配置：`proxy_set_header Host $host;` **必须存在**，且不能写成 `$proxy_host` 或其他
   - 改完必须 `nginx -t && nginx -s reload`
2. **域名不匹配**
   - 三者必须**完全一致**（大小写、是否带 www）：
     - Nginx `server_name aaa.example.com;`
     - frpc.toml `customDomains = ["aaa.example.com"]`
     - 浏览器实际访问的域名
3. **frpc 没注册成功**
   - 看 Windows 侧 frpc.log 有没有 `start proxy success`

---

### Q2. 返回 **502 Bad Gateway**

**原因**：Nginx → frps 或 frpc → 本地服务链路断开。

排查步骤：
1. frps 正常吗？
   ```bash
   systemctl status frps
   ss -tlnp | grep 8080
   ```
2. Nginx → frps 8080 能通吗？
   ```bash
   curl -v http://127.0.0.1:8080 -H "Host: aaa.example.com"
   ```
3. frpc 还在线吗？查看 frps.log 有没有 client disconnect
4. Windows 本地 80 端口活着吗？本机访问 `http://127.0.0.1`
5. 查 Nginx 错误日志：`tail -f /var/log/nginx/aaa.example.com.error.log`

---

### Q3. 返回 **504 Gateway Timeout**

**原因**：超时（frpc 响应太慢、网络抖动、本地服务卡住）。

排查与修复：
1. 确认 Windows 本地 `http://127.0.0.1` 访问速度正常
2. 临时加大 Nginx 超时：
   ```nginx
   proxy_read_timeout 600s;
   proxy_send_timeout 600s;
   proxy_connect_timeout 120s;
   ```
3. 检查 frpc 日志有没有大量重连记录
4. 检查服务器与 Windows 的网络质量：
   - Linux 侧看 ping 延迟 / 丢包
   - 如果丢包严重，试试换 `transport.protocol = "kcp"` 或 `"quic"`

---

### Q4. frpc 日志显示 `connection timed out` 连不上 frps

**原因**：客户端 → 服务器 7000 端口不通。

排查（按概率从高到低）：
1. **云服务器安全组没放行 7000**（最常见！）
   - 登录阿里云/腾讯云控制台 → 安全组 → 入方向 → 放行 TCP 7000
2. Linux 系统防火墙
   - CentOS：`firewall-cmd --list-ports` 确认有 7000
   - Ubuntu：`ufw status`
3. serverAddr 填错了
   - 确认填的是**公网 IP**，不是内网 IP、不是 127.0.0.1
4. 服务器供应商额外防火墙
   - 阿里云还有「网络 ACL」、IDC 机房可能有硬件防火墙
5. 本地出口封了 7000
   - 换端口试试：把 frps bindPort 改成 443（如果 443 不用）或 8443
6. Windows 本机验证
   ```powershell
   Test-NetConnection 服务器IP -Port 7000
   # 或者用 telnet
   telnet 服务器IP 7000
   ```

---

### Q5. frps Dashboard 打不开（IP:7500 拒绝连接）

**原因**：配置没加载 / 监听地址错 / 端口没放行。

排查：
1. frps.toml 确认：
   ```toml
   [webServer]
   addr = "0.0.0.0"
   port = 7500
   user = "admin"
   password = "123456"
   ```
2. 重启 frps：`systemctl restart frps`
3. 看日志：`grep -i dashboard /usr/local/frp/frps.log`，应该有 `listen on 0.0.0.0:7500`
4. 看监听：`ss -tlnp | grep 7500`
5. 放行防火墙 + 安全组 7500 端口

---

### Q6. 图片加载慢 / 大文件上传失败 / 视频卡顿

优化建议：
1. **压缩**：在 frpc.toml 开启了 `useCompression = true`（图片视频效果有限，主要针对文本）
2. **带宽限流**：检查 `bandwidthLimit` 是否设太小（注释掉就是不限）
3. **Nginx 缓存静态资源**（可选）：
   ```nginx
   location ~* \.(jpg|jpeg|png|gif|css|js|ico|svg|woff2?)$ {
       proxy_pass http://127.0.0.1:8080;
       proxy_set_header Host $host;
       proxy_cache_valid 200 7d;
       expires 7d;
       add_header Cache-Control "public, max-age=604800";
   }
   ```
4. **文件上传大小**：检查 `client_max_body_size` 是否足够（已默认 1024m）
5. **CDN 加速**：Cloudflare 全站缓存静态资源（穿透成功后再开启）

---

### Q7. 修改了 frpc.toml 后配置没生效

**原因**：没有重启 frpc 服务 / 改了错误的文件。

操作步骤：
1. 确认编辑的文件是 `C:\Program Files\frp\frpc.toml`（不是压缩包解压目录里的）
2. **必须重启服务**：
   ```powershell
   cd "C:\Program Files\frp"
   .\nssm.exe restart FRPClient
   ```
3. 查看启动日志确认：`Get-Content ".\frpc.log" -Tail 50`

> 💡 小技巧：改完配置可以先前台跑一次 `.\frpc.exe -c .\frpc.toml` 确认没语法报错，再起服务。

---

### Q8. 使用 Cloudflare CDN 后穿透异常（521 / 522 错误）

Cloudflare 代理模式（橙色云）对 WebSocket、长连接、大文件上传有一定影响。

**解决方案**：
1. 测试阶段：Cloudflare DNS 设置为 **「DNS only」灰色云**，确认穿透 100% 正常
2. 生产开启：
   - Cloudflare SSL/TLS 模式选择 **「Full (strict)」**（前提是服务器上了有效 HTTPS 证书）
   - Cloudflare Rules → 针对 `aaa.example.com` 关掉 Brotli / Rocket Loader（可能干扰）
   - WebSocket 开启（默认已开）
   - 缓存级别选择 **Standard**，避免缓存过多动态内容

---

### Q9. frpc 每隔一段时间就断开重连（连接不稳定）

排查：
1. 日志里找原因：`Get-Content frpc.log | Select-String "reconnect|disconnect|heartbeat"`
2. 心跳超时？调大两端 heartbeatTimeout：
   ```toml
   # frps.toml
   [transport]
   heartbeatTimeout = 180
   
   # frpc.toml
   [transport]
   heartbeatInterval = 60
   heartbeatTimeout = 180
   ```
3. 网络质量差：试试切换协议 `transport.protocol = "kcp"` 或 `"quic"`（防火墙需要放行对应 UDP 端口）
4. Windows 休眠？关闭网卡省电模式：设备管理器 → 网卡属性 → 电源管理 → 取消「允许计算机关闭此设备以节约电源」

---

## 八、进阶：启用 HTTPS（Let's Encrypt 免费证书）

强烈建议生产环境启用 HTTPS，保护用户密码与隐私数据。

### 方式 A：Certbot 自动申请 + 自动配置 Nginx（推荐 Debain/Ubuntu）

```bash
# 1. 安装 certbot + nginx 插件
apt update
apt install -y certbot python3-certbot-nginx

# 2. 一键申请 + 自动写入 Nginx 配置
certbot --nginx -d aaa.example.com

# 按提示操作：输入邮箱 → 同意协议 → 选择是否跳转（选 2: Redirect）

# 3. 验证自动续期（Certbot 默认已配置 systemd timer）
certbot renew --dry-run
# 输出 success 表示续期测试成功
```

Certbot 会自动：
- 申请 Let's Encrypt 90 天免费证书
- 自动写入 ssl_certificate / ssl_certificate_key
- 自动加 80 → 443 301 跳转
- 自动配置续期 timer（到期前 30 天自动续）

### 方式 B：Certbot 独立模式 / CentOS

```bash
# CentOS 安装
yum install -y epel-release
yum install -y certbot python3-certbot-nginx

# 或者手动停止 Nginx 走 standalone 模式（Nginx 插件失败时备用）
systemctl stop nginx
certbot certonly --standalone -d aaa.example.com -m your@email.com
systemctl start nginx
```

### 方式 C：其他面板（宝塔/1Panel/AppNode）

在面板里操作即可：
1. 新建站点：域名填 `aaa.example.com`，PHP 版本选「纯静态」
2. 站点设置 → SSL → Let's Encrypt → 申请
3. 站点设置 → 反向代理 → 添加：
   - 代理名称：frp
   - 目标 URL：`http://127.0.0.1:8080`
   - 发送域名：`$host`（务必选择，或手动写入 Host 头）
   - 开启「替换 Host Header」

---

## 九、配置文件模板汇总

为方便快速部署，以下是所有关键配置文件的**可直接复制**版本（只需改 IP、token、密码）：

### 📄 frps.toml 最简生产版

```toml
bindAddr = "0.0.0.0"
bindPort = 7000
proxyBindAddr = "127.0.0.1"
vhostHTTPPort = 8080

[auth]
method = "token"
token = "123456"

[webServer]
addr = "0.0.0.0"
port = 7500
user = "admin"
password = "123456"

[log]
to = "./frps.log"
level = "info"
maxDays = 7
```

### 📄 frpc.toml 最简生产版

```toml
serverAddr = "123.123.123.123"
serverPort = 7000
loginFailExit = false

[auth]
method = "token"
token = "123456"

[webServer]
addr = "127.0.0.1"
port = 7400
user = "admin"
password = "FrpClient@789"

[log]
to = "./frpc.log"
level = "info"
maxDays = 7

[transport.tls]
enable = true

[[proxies]]
name = "web-80"
type = "http"
localIP = "127.0.0.1"
localPort = 80
customDomains = ["aaa.example.com"]

[proxies.transport]
useCompression = true
useEncryption = true
```

### 📄 frps.service systemd 单元

```ini
[Unit]
Description = FRP Server (Nginx Proxy Mode)
After = network.target syslog.target network-online.target
Wants = network-online.target

[Service]
Type = simple
WorkingDirectory = /usr/local/frp
ExecStart = /usr/local/frp/frps -c /usr/local/frp/frps.toml
Restart = always
RestartSec = 5s

[Install]
WantedBy = multi-user.target
```

### 📄 Nginx 反代配置（HTTP + Dashboard）

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name aaa.example.com;

    access_log  /var/log/nginx/aaa.example.com.access.log  main;
    error_log   /var/log/nginx/aaa.example.com.error.log   warn;

    client_max_body_size 1024m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        proxy_buffering off;
    }

    location ^~ /_frp_dashboard/ {
        proxy_pass http://127.0.0.1:7500/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 十、安全加固建议（生产必做）

1. **Token 设置得足够复杂**：至少 20 位，混合大小写 + 数字 + 特殊字符
2. **Dashboard 不要裸奔**：
   - 方案 A：`addr = "127.0.0.1"` + Nginx 反代 + Basic Auth 双因子
   - 方案 B：监听 0.0.0.0 但用 iptables 只允许你的办公出口 IP 访问 7500
3. **开启 TLS**：frpc `transport.tls.enable = true`（v0.68.0 默认，确认没关掉）
4. **HTTPS 全站**：Let's Encrypt 证书安排上，避免数据明文
5. **限制客户端代理数**：frps `maxPortsPerClient = 20`（防止滥用）
6. **frp 文件权限**：
   ```bash
   chown -R root:root /usr/local/frp
   chmod 700 /usr/local/frp
   chmod 600 /usr/local/frp/frps.toml   # 防止配置文件被其他用户读到 token
   ```
7. **不要用默认端口**：有条件就把 bindPort 7000 改为 5 位数随机端口（减少扫描探测）

