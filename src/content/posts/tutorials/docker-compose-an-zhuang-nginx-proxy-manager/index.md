---
title: "docker-compose安装 Nginx Proxy Manager"
published: 2023-10-09
description: "官网：https://nginxproxymanager.com/"
tags: ["docker","Nginx"]
category: "Docker"
draft: false
lang: zh_CN
---

官网：https://nginxproxymanager.com/

## [1. 安装Docker](https://docs.docker.com/get-docker/)

## [2.安装Docker-Compose](https://docs.docker.com/compose/install/)

## 3.创建`docker-compose.yml`文件

```shell
mkdir -p ~/data/docker_data/nginxproxymanager   # 创建一个 npm 的文件夹

cd ~/data/docker_data/nginxproxymanager    # 进入该文件夹

vim docker-compose.yml
```

```yaml
version: "3.8"
services:
  app:
    image: "jc21/nginx-proxy-manager:latest"
    restart: unless-stopped
    ports:
      - "80:80"
      - "81:81"
      - "443:443"
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
```

## 4.启动并修改用户名密码

```shell
# -d 表示后台运行
docker-compose up -d
```

![image-20231009145929408](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231009145929408.png)

`登录协议必须是https`

默认登陆的用户名：`admin@example.com` 密码：`changeme`

首次次登陆会提示更改用户名和密码

![Nginx Proxy Manager 1](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/Nginx-Proxy-Manager-1-ab1ff5beca03af013ce4236cab4244ee-1696834853233-3-1696834855233-5-1696834865948-7.png)

![Nginx Proxy Manager 2](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/Nginx-Proxy-Manager-2-6078349af82791cc452c58322c72bd34.png)

## 5.代理配置

![image-20231009150441368](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231009150441368.png)

- `Domain Names` ：填自己网站的域名，先做好 DNS 解析
- `Scheme` ：默认 `http` 即可，除非你有自签名证书
- `Forward Hostname/IP` ：填入服务器的 IP，或者 Docker 容器内部的 IP（如果 NPM 和网站搭建在同一台服务器上的话）
- `Forward Port`：网站映射出的端口
- `Cache Assets` ：缓存，可以选择打开
- `Block Common Exploits`： 阻止常见的漏洞，可以选择打开
- `Websockets Support` ：WS 支持，可以选择打开
- `Access List`： 这个是 NPM 自带的一个限制访问功能

## 6.申请SSL证书

可以申请一张 SSL 证书，让我们的网站支持 `https` 访问

![Nginx Proxy Manager 6](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/Nginx-Proxy-Manager-6-d229f39af6e6788ec2d0f51d2aaae061.png)

![Nginx Proxy Manager 7](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/Nginx-Proxy-Manager-7-05a349de1dbad28b5b34fa9c6b8c9984.png)

不出意外，你将成功申请到 SSL 证书，证书会三个月自动续期

部分内容和图片来自[Halo官网](https://docs.halo.run/getting-started/install/other/nginxproxymanager)

