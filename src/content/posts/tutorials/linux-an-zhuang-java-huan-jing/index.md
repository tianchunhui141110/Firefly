---
title: "Linux安装Java环境"
published: 2021-01-17
description: "Linux安装Java环境"
tags: ["Java","Linux"]
category: "Java"
draft: false
lang: zh_CN
---

Linux安装Java环境

1、下载

https://www.oracle.com/java/technologies/javase/javase-jdk8-downloads.html

2、上传

- 
新建目录

```shell
mkdir /usr/local/jdk
cd /usr/local/jdk

```

- 
安装上传软件

```shell
yum install -y lrzsz

```

- 
拖拽上传jdk文件

- 
解压

```shell
tar -xvf jdk-8u161-linux-x64.tar.gz

```

- 
配置环境变量

```shell
vim /etc/profile

```

```shell
# 在文件末尾添加下面的配置 注意：JAVA_HOME的路径是你实际解压后的JDK的路径，千万别写错了
export JAVA_HOME=/usr/local/jdk/jdk1.8.0_161
export PATH=$JAVA_HOME/bin:$PATH
export CLASSPATH=.:$JAVA_HOME/jre/lib/rt.jar:$JAVA_HOME/lib/dt.jar:$JAVA_HOME/lib/tools.jar
export PATH=$PATH:$JAVA_HOME/bin

```

- 
生效环境变量

```shell
source /etc/profile

```

- 
验证安装

```shell
java
javac
java -version

```
