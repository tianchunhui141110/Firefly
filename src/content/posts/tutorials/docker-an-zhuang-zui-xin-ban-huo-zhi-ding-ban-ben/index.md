---
title: "Docker安装指定版本"
published: 2020-02-12
description: ""
tags: ["Docker"]
category: "Docker"
draft: false
lang: zh_CN
---

- 通过阿里云源站一键安装

  ```sh
  curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun
  ```

- 先查看有没有安装过docker

  ```shell
  yum list installed | grep docker
  ```

- 如果已经有docker，并且想重新安装的执行下面的操作 否则忽略

  ![image-20200212150336772](https://blog.tianch.com.cn/img/image-20200212150336772.png)

  ```shell
  yum remove docker-ce.x86_64 docker-ce-cli.x86_64 -y
  #注意 删除的是你查出来的包 不要全部照抄
  rm -rf /etc/docker
  rm -rf /run/docker
  rm -rf /var/lib/dockershim
  rm -rf /var/lib/docker
  ```

- 安装依赖

  ```shell
  yum install -y yum-utils device-mapper-persistent-data lvm2
  ```

- 添加docker软件源

  ```shell
  yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
  ```

- 更新yum索引

  ```shell
  yum makecache fast
  ```

- 搜索出可安装yum包

  ```shell
  yum list docker-ce --showduplicates|sort -r
  ```

  ![image-20200313174615611](https://blog.tianch.com.cn/img/image-20200313174615611.png)

- 安装指定版本

  ```shell
  # yum  -y install docker-ce是安装最新版本 我为了兼容k8s 安装18.03
  yum  -y install docker-ce-18.03.1.ce-1.el7.centos
  ```

- 启动docker

  ```shell
  systemctl start docker
  ```

- 设置开机自启动

  ```shell
  systemctl enable docker
  ```

- 查看版本

  ```shell
  docker version
  ```

  ![image-20200313175418462](https://blog.tianch.com.cn/img/image-20200313175418462.png)

