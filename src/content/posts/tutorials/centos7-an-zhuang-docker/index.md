---
title: "CentOS7安装Docker"
published: 2020-05-12
description: "CentOS7安装Docker"
tags: ["Docker","CentOS"]
category: "Linux"
draft: false
lang: zh_CN
---

CentOS7安装Docker

- 
先查看有没有安装过docket

yum list installed | grep docker
`

- 
如果已经有docker，并且想重新安装的执行下面的操作 否则忽略

![image.png](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20200212150336772.png)

yum remove docker-ce.x86_64 docker-ce-cli.x86_64 -y 
#注意 删除的是你查出来的包 不要全部照抄
rm -rf /etc/docker
rm -rf /run/docker
rm -rf /var/lib/dockershim
rm -rf /var/lib/docker
`

- 
安装依赖

yum install -y yum-utils device-mapper-persistent-data lvm2
`

- 
添加docker软件源

yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
`

- 
更新yum索引

yum makecache fast
`

- 
搜索出可安装yum包

yum list docker-ce --showduplicates|sort -r
`

![image.png](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20200313174615611.png)

- 
安装指定版本

#安装最新版 
yum  -y install docker-ce
#安装指定版本 比如18.03.1.ce-1.el7.centos
yum  -y install docker-ce-18.03.1.ce-1.el7.centos
`

- 
启动docker

systemctl start docker
`

- 
设置开机自启动

systemctl enable docker
`

- 
查看版本

docker version
`

![image.png](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20200313175418462.png)
