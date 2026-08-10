---
title: "Docker终端无法输入中文问题解决"
published: 2026-01-05
description: "在docker里搭建了一套MySQL服务，发现在MySQL命令行内无法输入中文"
tags: ["Docker"]
category: "Docker"
draft: false
lang: zh_CN
---

在docker里搭建了一套MySQL服务，发现在MySQL命令行内无法输入中文

```shell
# 进入容器查看字符集
root@0a4abbf91291:/# locale
LANG=
LANGUAGE=
LC_CTYPE="POSIX"
LC_NUMERIC="POSIX"
LC_TIME="POSIX"
LC_COLLATE="POSIX"
LC_MONETARY="POSIX"
LC_MESSAGES="POSIX"
LC_PAPER="POSIX"
LC_NAME="POSIX"
LC_ADDRESS="POSIX"
LC_TELEPHONE="POSIX"
LC_MEASUREMENT="POSIX"
LC_IDENTIFICATION="POSIX"
LC_ALL=
root@0a4abbf91291:/# locale -a
C
C.UTF-8
POSIX
```

不能输入中文的原因: 系统使用的是POSIX字符集，POSIX字符集是不支持中文的，而C.UTF-8是支持中文的 只要把系统中的环境 LANG 改为”C.UTF-8”格式即可解决

进入容器或者在宿主机上执行docker中的服务可以加上参数:

```shell
docker exec -it [容器Id] env LANG=C.UTF-8 mysql -uroot -p
```

注意:这种修改只能临时修改.永久修改需要到`Dockerfile`中设置.

