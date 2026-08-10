---
title: "vim编辑文件关闭后，文件内容仍显示在窗口的解决办法"
published: 2026-01-05
description: "是因为linux环境变量TERM设置类型不对，TERM环境变量是用来设置输出终端类型的，Xshell如果设置成Linux就会出现类似这种情况，如果设置成xterm就可以避免这种情况。"
tags: ["运维"]
category: "其他"
draft: false
lang: zh_CN
---

#### 1.原因

是因为linux环境变量TERM设置类型不对，TERM环境变量是用来设置输出终端类型的，Xshell如果设置成Linux就会出现类似这种情况，如果设置成xterm就可以避免这种情况。

#### 2.解决方法

```shell
#在 ~/.bashrc 中加入命令 ：export TERM=xterm 然后重启

cd ~
vim .bashrc


# .bashrc

# User specific aliases and functions

alias rm='rm -i'
alias cp='cp -i'
alias mv='mv -i'

# Source global definitions
if [ -f /etc/bashrc ]; then
        . /etc/bashrc
fi
export TERM=xterm
```

