---
title: "Linux下基于Docker安装MySQL5.7"
published: 2020-05-27
description: ""
tags: ["Docker","MySQL","Linux"]
category: "Docker"
draft: false
lang: zh_CN
---

- 拉取mysql:5.7.29镜像

  ```shell
  docker pull mysql:5.7.29
  ```

- 创建一个临时的msyql:5.7.29容器，目的是cp 容器里mysql的配置文件

  ```shell
  docker run -d -p 3306:3306 --name myMysql -e MYSQL_ROOT_PASSWORD=root mysql:5.7.29
  ```

- 复制容器中的mysql配置文件到宿主机指定目录

  ```shell
  docker cp myMysql:/etc/mysql  /etc
  ```

- 在/etc/mysql里创建data目录

  ```shell
  mkdir /etc/mysql/data
  ```

- 停止并删除myMysql容器

  ```shell
  docker stop myMysql
  docker rm myMysql
  ```

- 创建并启动mysql:5.7.29容器

```shell
docker run --restart=always --privileged=true -p 3306:3306 --name mysql5.7.29 -v /etc/mysql:/etc/mysql -v /etc/mysql/data:/var/lib/mysql -e MYSQL_ROOT_PASSWORD=root -d mysql:5.7.29
```

- 命令行参数解释

  ```shell
  --restart always                                -> 开机启动
  --privileged=true                               -> 提升容器内权限
  -v /etc/mysql:/etc/mysql				        -> 映射配置文件
  -v /etc/mysql/data:/var/lib/mysql			    -> 映射数据目录
  -e MYSQL_USER="summit"                          -> 添加用户summit
  -e MYSQL_PASSWORD="summit"                      -> 设置summit用户的密码为summit
  -e MYSQL_ROOT_PASSWORD="root"                   -> 设置root的密码为root
  ```

- 进入容器的命令

  ```shell
  docker exec -it 容器Id /bin/bash
  ```

- 容器中没有vim的解决办法

  ```shell
  apt-get install vim
  	Reading package lists... Done
  	Building dependency tree
  	Reading state information... Done
  	E: Unable to locate package vim
          #如果出现如上错误 先执行更新操作
          apt-get update
          #再执行安装操作
          apt-get install vim
  ```

- 容器中没有 ll命令的解决办法

  ```shell
  vim ~/.bashrc
  #找到alias ll=’ls $LS_OPTIONS -l’将前面的’#'去掉 在新的终端里就可以了
  ```

- MySQL编码问题

  ```shell
  vim /etc/mysql/mysql.conf.d/mysqld.cnf
  #添加下面的内容
  	[mysql]
      #设置mysql客户端默认字符集
      default-character-set=utf8

     [mysqld]
  	#允许最大连接数
      max_connections=2000

      #服务端使用的字符集默认为8比特编码的latin1字符集
      character-set-server=utf8
      ##创建新表时将使用的默认存储引擎
      default-storage-engine=INNODB
      lower_case_table_names=1
      max_allowed_packet=16M
      ##设置时区
      default-time_zone='+8:00'
  ```

- 重启MySQL容器

  ```shell
  docker restart 容器Id
  ```

- 查看MySQL字符集

  ```shell
  #进入docker容器
  mysql -uroot -p
  	mysql> show variables like '%character%';
      +--------------------------+----------------------------+
      | Variable_name            | Value                      |
      +--------------------------+----------------------------+
      | character_set_client     | utf8                       |
      | character_set_connection | utf8                       |
      | character_set_database   | utf8                       |
      | character_set_filesystem | binary                     |
      | character_set_results    | utf8                       |
      | character_set_server     | utf8                       |
      | character_set_system     | utf8                       |
      | character_sets_dir       | /usr/share/mysql/charsets/ |
      +--------------------------+----------------------------+
      8 rows in set (0.00 sec)
  ```

- 查看MySQL版本

  ```shell
  mysql> SHOW VARIABLES WHERE Variable_name = 'version';
  +---------------+--------+
  | Variable_name | Value  |
  +---------------+--------+
  | version       | 5.7.29 |
  +---------------+--------+
  1 row in set (0.00 sec)
  ```

