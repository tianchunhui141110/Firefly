---
title: "Docker里使用CentOS7中文乱码的解决办法"
published: 2026-01-05
description: "在使用docker制作tomcat镜像后，进入容器内部，发现中文出现乱码"
tags: ["Docker","CentOS"]
category: "Docker"
draft: false
lang: zh_CN
---

在**[使用docker制作tomcat镜像](http://www.tianch.xyz/archives/docker%E5%88%B6%E4%BD%9Ctomcat%E9%95%9C%E5%83%8F)**后，进入容器内部，发现中文出现乱码

#### 解决办法

- 在Dockerfile中配置中文支持

  ```shell
  #安装中文支持 不然会乱码
  RUN yum -y install kde-l10n-Chinese && yum -y reinstall glibc-common
  #配置显示中文
  RUN localedef -c -f UTF-8 -i zh_CN zh_CN.utf8
  #设置环境变量
  ENV LC_ALL zh_CN.utf8
  ```

  - 注意 CentOS8不适用

- 物理机上

  ```shell
  yum -y install kde-l10n-Chinese && yum -y reinstall glibc-common
  localedef -c -f UTF-8 -i zh_CN zh_CN.utf8
  export LC_ALL=zh_CN.utf8
  ```

