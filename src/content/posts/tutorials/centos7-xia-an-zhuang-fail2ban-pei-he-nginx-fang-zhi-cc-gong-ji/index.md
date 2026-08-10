---
title: "Centos7下安装Fail2ban 配合Nginx防止CC攻击"
published: 2020-08-13
description: "从CentOS7(RHEL7)开始，官方的标准防火墙设置软件从iptables变更为firewalld。 因此，为了使Fail2ban与iptables联动，需禁用自带的firewalld服务，同时安装iptables服务。"
tags: ["Nginx"]
category: "Nginx"
draft: false
lang: zh_CN
---

### Fail2ban简介

- Fail2ban可以监视你的系统日志，然后匹配日志的错误信息（正则式匹配）执行相应的屏蔽动作（一般情况下是调用防火墙屏蔽），如:当有人在试探你的HTTP、SSH、SMTP、FTP密码，只要达到你预设的次数，fail2ban就会调用防火墙屏蔽这个IP，而且可以发送e-mail通知系统管理员，是一款很实用、很强大的软件！
- Fail2ban由python语言开发，基于logwatch、gamin、iptables、tcp-wrapper、shorewall等。如果想要发送邮件通知道，那还需要安装postfix或sendmail。
- 在外网环境下，有很多的恶意扫描和密码猜测等恶意攻击行为，使用Fail2ban配合iptables，实现动态防火墙是一个很好的解决方案。

### 功能和特性

- 支持大量服务。如sshd,apache,qmail,proftpd,sasl等等
- 支持多种动作。如iptables,tcp-wrapper,shorewall(iptables第三方工具),mail notifications(邮件通知)等等。
- 在logpath选项中支持通配符
- 需要Gamin支持(注：Gamin是用于监视文件和目录是否更改的服务工具)
- 需要安装python,iptables,tcp-wrapper,shorewall,Gamin。如果想要发邮件，那必需安装postfix或sendmail

### 安装Fail2ban

```shell
yum install -y epel-release
yum install -y fail2ban
```

- 目录结构

  ```shell
  /etc/fail2ban/action.d            #动作文件夹，内含默认文件。iptables以及mail等动作配置

  /etc/fail2ban/fail2ban.conf        #定义了fai2ban日志级别、日志位置及sock文件位置

  /etc/fail2ban/filter.d            #条件文件夹，内含默认文件。过滤日志关键内容设置

  /etc/fail2ban/jail.conf            #主要配置文件，模块化。主要设置启用ban动作的服务及动作阀值

  /etc/rc.d/init.d/fail2ban          #启动脚本文件
  ```

### 关闭防火墙、安装iptables

从CentOS7(RHEL7)开始，官方的标准防火墙设置软件从iptables变更为firewalld。 因此，为了使Fail2ban与iptables联动，需禁用自带的firewalld服务，同时安装iptables服务。

- 停止和禁用自带的firewalld服务。

  ```shell
  systemctl stop firewalld
  systemctl disable firewalld
  ```

- 安装iptables

  ```shell
  yum install -y iptables
  yum install -y iptables-services
  ```

- 为了记录iptables防火墙丢弃的数据包到日志文件，还需修改/etc/rsyslog.conf文件

```shell
vim  /etc/rsyslog.conf

#填入以下内容。
kern.*     /var/log/iptables.log

#启rsyslog服务
service rsyslog restart

#还需对日志文件每隔一段时间（一周）进行切割，所以需要编辑/etc/logrotate.d/syslog文件。
vim /etc/logrotate.d/syslog

#填入以下内容
/var/log/iptables.log

```

- 重启iptables

```shell
service iptables save
service iptables restart
```

- 查看iptables现有规则

```shell
iptables -L -n
```

- 脚本说明

  ```shell
  iptables -P INPUT ACCEPT                	   #表示先允许所有的输入通过防火墙,以防远程连接断开
  iptables -F 			  					   #表示清空所有默认规则
  iptables -X				 					   #表示清空所有自定义规则
  iptables -Z 			 				       #表示将所有计数器归0
  iptables -A INPUT -i lo -j ACCEPT			   #表示允许来自于lo接口（本地访问）的数据包
  iptables -A INPUT -p tcp --dport 22 -j ACCEPT  #表示开放22端口(SSH)
  iptables -A INPUT -p tcp --dport 80 -j ACCEPT  #表示开放80端口(HTTP)
  iptables -A INPUT -p tcp --dport 443 -j ACCEPT #表示开放443端口(HTTPS)
  iptables -P INPUT DROP						   #表示其他入站一律丢弃
  iptables -P OUTPUT ACCEPT 					   #表示所有出站一律通过
  iptables -P FORWARD DROP					   #表示所有转发一律通过
  iptables -A INPUT -s 192.168.0.1/24 -j ACCEPT  #添加可信任网段192.168.0.1/24，接受其所有请求
  iptables -I INPUT -s 192.168.0.1 -j DROP	   #封停一个IP：192.168.0.1
  iptables -A INPUT -p tcp -s 192.168.0.1 -j ACCEPT #添加可信任ip：192.168.0.1，接受其所有TCP请求
  iptables -I INPUT -p tcp -s 192.168.0.1 --dport 3306 -j ACCEPT #添加可信任ip：192.168.0.1，接受其对某个端口：3306的所有TCP请求
  iptables -A INPUT  -p tcp -j LOG --log-prefix "iptables denied" #表示所有被丢弃的包都会被记录到/var/log/iptables.log文件中，且每条记录会以”iptables denied”作为前缀
  iptables -A INPUT -m state --state  RELATED,ESTABLISHED -j ACCEPT #表示允许接受本机请求之后的返回数据
  ```

### 配置Fail2ban 这里只配置[nginx-cc]模块，其它需求自行百度

- 新建jail.local来覆盖Fail2ban在jail.conf的默认配置

```shell
cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
vim /etc/fail2ban/jail.local
```

- 新增[nginx-cc]模块

    ```shell
    [nginx-cc]
    enabled = true
    port = http,https
    filter = nginx-cc
    action = %(action_mwl)s
    maxretry = 5
    findtime = 60
    bantime = 30
    logpath = /usr/local/nginx/logs/access.log

    #配置意思是如果在60s内,同一IP达到5次请求,则将其IP ban 30s,上面只是为了测试,请根据自己的实际情况修改。logpath为nginx日志路径
    ```

- 新建一个nginx日志匹配规则

```shell
vim /etc/fail2ban/filter.d/nginx-cc.conf

#填写如下内容
[Definition]
failregex = <HOST> -.*- .*HTTP/1.* .* .*$
ignoreregex =

```

- 重启fail2ban

```shell
systemctl restart fail2ban
```

- 查看配置是否生效

  ```shell
  fail2ban-client status
  ```

- fail2ban 其它命令

  ```shell
  systemctl start fail2ban #启动Fail2ban
  systemctl stop fail2ban  #停止Fail2ban
  systemctl enable fail2ban #开机启动Fail2ban
  fail2ban-client status nginx-cc #查看被ban IP，其中ssh-iptables为名称
  fail2ban-client set nginx-cc addignoreip IP地址 #添加白名单
  fail2ban-client set ssh-iptables delignoreip IP地址 #删除白名单
  iptables -L -n #查看被禁止的IP地址
  ```

参考

https://www.jianshu.com/p/4fdec5794d08

https://bolerolily.github.io/2018/09/06/CentOS7%E5%AE%89%E8%A3%85%E5%92%8C%E9%85%8D%E7%BD%AEiptables%E9%98%B2%E7%81%AB%E5%A2%99/

https://www.bnxb.com/linuxserver/27516.html

http://blog.iyunv.com/564.html

