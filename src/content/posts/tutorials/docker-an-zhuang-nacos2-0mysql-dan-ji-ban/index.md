---
title: "docker安装nacos2.0MySQL单机版"
published: 2026-01-05
description: "下载nacos源码包 我下载的2.0.3版本,上传到服务器上"
tags: ["docker","MySQL","nacos"]
category: "中间件"
draft: false
lang: zh_CN
---

下载nacos源码包 我下载的2.0.3版本,上传到服务器上

```shell
tar -xvf nacos-docker-2.0.3.tar.gz
```

```shell
mkdir -p /usr/local/docker/nacos-server
mkdir -p /usr/local/docker/nacos-server/env
mkdir -p /usr/local/docker/nacos-server/logs
mkdir -p /usr/local/docker/nacos-server/init.d
```

```shell
cp example/custom.properties /usr/local/docker/nacos-server/init.d/
cp env/nacos-standlone-mysql.env /usr/local/docker/nacos-server/env/
```

```shell
cd /usr/local/docker/nacos-server
```

```shell
vim env/nacos-standlone-mysql.env
```

```properties
PREFER_HOST_MODE=hostname
MODE=standalone
SPRING_DATASOURCE_PLATFORM=mysql
MYSQL_SERVICE_HOST=192.168.0.233
MYSQL_SERVICE_DB_NAME=nacos
MYSQL_SERVICE_PORT=3306
MYSQL_SERVICE_USER=root
MYSQL_SERVICE_PASSWORD=root

JVM_XMS=512m
JVM_XMX=512m
JVM_XMN=256m
```

```shell
docker run -p 8848:8848 -p 9848:9848 -p 9849:9849 --restart=always --name nacos --env-file=/usr/local/docker/nacos-server/env/nacos-standlone-mysql.env -v /usr/local/docker/nacos-server/logs:/home/nacos/logs -v /usr/local/docker/nacos-server/init.d/custom.properties:/home/nacos/init.d/custom.properties -d nacos/nacos-server:2.0.3
```

