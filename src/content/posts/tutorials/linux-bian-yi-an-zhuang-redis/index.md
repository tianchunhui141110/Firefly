---
title: "Linux编译安装Redis"
published: 2020-05-27
description: ""
tags: ["Redis","Linux"]
category: "Redis"
draft: false
lang: zh_CN
---

- 安装C++环境

  ```shell
  yum install gcc
  yum install gcc-c++
  ```

- 下载redis的安装文件

  ```shell
  wget -P /opt/redis http://download.redis.io/releases/redis-5.0.8.tar.gz
  ```

- 解压并进入

  ```shell
  cd /opt/redis
  tar -xvf redis-5.0.8.tar.gz
  cd redis-5.0.8
  ```

- 编译

  ```shell
  make
  ```

- 安装到指定目录

  ```shell
  make install PREFIX=/opt/redis
  ```

- 将配置文件redis.conf复制到安装目录的bin里

  ```shell
  cp /opt/redis/redis-5.0.8/redis.conf /opt/redis/bin
  ```

- 配置redis后台启动和密码 其它配置自行修改

  ```shell
  vim redis.conf
  #修改绑定IP 修改为内网IP 不要修改为公网IP
  bind 192.168.123.5
  #开启后台启动 no 改成 yes
  daemonize yes
  #设置密码 找到requirepass 取消注释 修改密码
  requirepass 123456
  ```

- 启动redis

  ```shell
  ./redis-server ./redis.conf
  ```

- 停止redis

  ```shell
  ./redis-cli -h 192.168.123.5 -a 123456
  192.168.123.5:6379> shutdown
  ```

