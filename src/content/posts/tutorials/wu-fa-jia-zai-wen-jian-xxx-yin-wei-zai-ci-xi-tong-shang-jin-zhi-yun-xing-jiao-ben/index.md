---
title: "无法加载文件 xxx 因为在此系统上禁止运行脚本"
published: 2026-01-05
description: ""
tags: ["运维"]
category: "其他"
draft: false
lang: zh_CN
---

1、在系统中搜索框]输入 Windos PowerShell

2、点击“管理员身份运行”

3、输入` set-ExecutionPolicy RemoteSigned`回车

4、根据提示，输入A，回车

5、再次执行命令就可执行成功。

