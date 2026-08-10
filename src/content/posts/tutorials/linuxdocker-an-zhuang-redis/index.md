---
title: "Linux docker安装Redis"
published: 2026-01-05
description: ""
tags: ["docker","Redis","Linux"]
category: "Docker"
draft: false
lang: zh_CN
---

```shell
docker run -p 6379:6379 --name redis -v /opt/redis/docker/redis.conf:/usr/local/bin/redis.conf -v /opt/redis/docker/data:/data -d redis:5.0.8 redis-server /usr/local/bin/redis.conf



docker run -d --name redis --restart always -p 6379:6379 -v /opt/redis/docker/data:/data redis --requirepass "123456 --appendonly yes --bind 192.168.123.5
```

