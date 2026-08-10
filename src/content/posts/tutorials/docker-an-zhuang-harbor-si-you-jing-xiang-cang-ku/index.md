---
title: "Docker安装Harbor私有镜像仓库"
published: 2022-02-16
description: "仅适用于公网环境"
tags: ["Docker"]
category: "Docker"
draft: false
lang: zh_CN
---

### 1.安装docker环境

1. 安装／升级Docker客户端

   仅适用于公网环境

   ```shell
   curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun
   ```

2. 配置镜像加速器

   去阿里云控制台-容器镜像服务-镜像加速器-找到你的加速地址

   ```shell
   sudo mkdir -p /etc/docker
   sudo tee /etc/docker/daemon.json <<-'EOF'
   {
     "registry-mirrors": ["https://xxxx.mirror.aliyuncs.com"]
   }
   EOF
   sudo systemctl daemon-reload
   sudo systemctl restart docker
   ```

### 2.申请(免费)证书

自己申请

证书pem转crt

```shell
openssl x509 -in xxx.pem -out xxx.crt
```

### 3.域名解析

自己申请域名 自己解析

### 4.安装Docker-compose

1. 去[github](https://github.com/docker/compose/releases)下载最新安装文件

2. 移动并授权

   ```shell
   cp docker-compose-linux-x86_64 /usr/local/bin/
   cd /usr/local/bin
   mv docker-compose-linux-x86_64 docker-compose
   chmod +x docker-compose
   docker-compose --version
   ```

### 5.安装Harbor

1. 下载并上传证书到服务器

2. 下载在线安装包并解压

   ```shell
   yum install -y wget
   wget https://github.com/goharbor/harbor/releases/download/v2.4.1/harbor-online-installer-v2.4.1.tgz
   tar -xvf harbor-online-installer-v2.4.1.tgz
   ```

3. 配置Harbor

   cd 到解压后的文件夹
   - 复制一份配置文件

     ```shell
     cp harbor.yml.tmpl harbor.yml
     ```

   - 编辑配置文件

     ```shell
     vim harbor.yml
     ```

     ```yaml
     # Configuration file of Harbor

     # The IP address or hostname to access admin UI and registry service.
     # DO NOT use localhost or 127.0.0.1, because Harbor needs to be accessed by external clients.
     hostname: 你的harbor域名

     # http related config
     http:
       # port for http, default is 80. If https enabled, this port will redirect to https port
       port: 80

     # https related config
     https:
       # https port for harbor, default is 443
       port: 443
       # The path of cert and key files for nginx
       certificate: pem或crt文件的路径
       private_key: key文件的路径

     # # Uncomment following will enable tls communication between all harbor components
     # internal_tls:
     #   # set enabled to true means internal tls is enabled
     #   enabled: true
     #   # put your cert and key files on dir
     #   dir: /etc/harbor/tls/internal

     # Uncomment external_url if you want to enable external proxy
     # And when it enabled the hostname will no longer used
     # external_url: https://reg.mydomain.com:8433

     # The initial password of Harbor admin
     # It only works in first time to install harbor
     # Remember Change the admin password from UI after launching Harbor.
     harbor_admin_password: Harbor12345

     # Harbor DB configuration
     database:
       # The password for the root user of Harbor DB. Change this before any production use.
       password: 最好改一下
       # The maximum number of connections in the idle connection pool. If it <=0, no idle connections are retained.
       max_idle_conns: 100
       # The maximum number of open connections to the database. If it <= 0, then there is no limit on the number of open connections.
       # Note: the default number of connections is 1024 for postgres of harbor.
       max_open_conns: 900
     ```

   - 启动

     ```shell
     ./install.sh
     ```

   安装完成后访问`https://你的域名`

   默认账号密码:admin/Harbor12345

   ![image-20220216104738377](https://blog.tianch.com.cn/img/image-20220216104738377.png)

