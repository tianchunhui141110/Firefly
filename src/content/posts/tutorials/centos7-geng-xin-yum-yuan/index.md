---
title: "CentOS7更新Yum源"
published: 2026-01-05
description: ""
tags: ["CentOS"]
category: "Linux"
draft: false
lang: zh_CN
---

## 更新为阿里yum源

```shell
1.安装wget
yum install -y wget

2.备份配置文件
mv /etc/yum.repos.d/CentOS-Base.repo /etc/yum.repos.d/CentOS-Base.repo.bak

3.下载阿里yum源文件
wget -O /etc/yum.repos.d/CentOS-Base.repo http://mirrors.aliyun.com/repo/Centos-7.repo

4.清理缓存
yum clean all

5.重新生成缓存
yum makecache
```

## 更新为华为yum源

```shell
1.安装wget
yum install -y wget

2.备份配置文件
mv /etc/yum.repos.d/CentOS-Base.repo /etc/yum.repos.d/CentOS-Base.repo.bak

3.下载华为yum源文件
wget -O /etc/yum.repos.d/CentOS-Base.repo https://repo.huaweicloud.com/repository/conf/CentOS-7-reg.repo

4.清理缓存
yum clean all

5.重新生成缓存
yum makecache
```

