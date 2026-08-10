---
title: "docker 安装redis"
published: 2026-01-05
description: ""
tags: ["docker"]
category: "Docker"
draft: false
lang: zh_CN
---

#### 1.拉取redis

```shell
#拉取最新的5版本5.0.10
docker pull redis:5.0.10
#拉取最新版 目前已经到了redis6
docker pull redis
docker pull redis:latest
#上面两条命令效果一样
```

#### 2.直接运行（不推荐 删除容器之后数据丢失）

```shell
docker run -d -p 6379:6379 --name my-redis redis
```

#### 3.以配置文件方式运行

- 创建配置文件目录和数据目录

  ```shell
  mkdir -p /opt/redis/conf
  mkdir -p /opt/redis/data
  ```

- 从redis官网扒一份`redis.conf`配置文件 拷贝到配置文件目录

  ```shell
  yum install wget -y
  cd /opt/redis
  wget http://download.redis.io/releases/redis-5.0.10.tar.gz
  tar -xvf redis-5.0.10.tar.gz
  cp redis-5.0.10/redis.conf ./conf
  ```

- 修改配置文件`redis.conf`

  ```shell
  # 注释掉 或者修改为 bind 0.0.0.0
  # bind 127.0.0.1

  #默认为yes 改为no 允许远程访问
  protected-mode no

  # 设置密码
  requirepass 你的密码

  # 开启aof持久化
  appendonly yes

  # 注意daemonize参数 以docker形式部署redis时不要开启守护进程运行 和 docker rum -d 冲突了 会导致容器启动失败
  daemonize no
  ```

- 启动

  ```shell
  ocker run -itd -p 6379:6379 --name redis -v /opt/redis/data:/data -v /opt/redis/conf/redis.conf:/etc/redis/conf/redis.conf redis:5.0.10 redis-server /etc/redis/conf/redis.conf
  ```

  - docker rum [OPTIONS]说明

    ```shell
    --name="容器新名字": 为容器指定一个名称;
    -d: 后台运行容器，并返回容器ID，也即启动守护式容器;
    -i:以交互模式运行容器，通常与 -t 同时使用;
    -t:为容器重新分配一个伪输入终端，通常与 -i 同时使用;
    -v: 本地文件(夹):容器文件(夹) 用于挂载本地文件(夹)到容器
    -P: 随机端口映射;
    -p: 指定端口映射，有以下四种格式
          ip:hostPort:containerPort
          ip::containerPort
          hostPort:containerPort
          containerPort
    ```

  #### 4.测试

  ```shell
  [root@localhost redis]# docker exec -it redis redis-cli
  127.0.0.1:6379> auth redis123456
  OK
  127.0.0.1:6379> dbsize
  (integer) 0
  127.0.0.1:6379>
  [root@localhost redis]# docker exec -it redis redis-cli
  127.0.0.1:6379> auth 123456
  (error) ERR invalid password
  127.0.0.1:6379>
  [root@localhost redis]# docker exec -it redis redis-cli
  127.0.0.1:6379> auth redis123456
  OK
  127.0.0.1:6379> dbsize
  (integer) 0
  127.0.0.1:6379> set k1 v1
  OK
  127.0.0.1:6379> mset k2 v2 k3 v3
  OK
  127.0.0.1:6379> dbsize
  (integer) 3
  127.0.0.1:6379> keys *
  1) "k3"
  2) "k1"
  3) "k2"
  127.0.0.1:6379> get k1
  "v1"
  127.0.0.1:6379> mget k1 k2 k3
  1) "v1"
  2) "v2"
  3) "v3"
  ```

