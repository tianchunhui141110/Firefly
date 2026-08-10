---
title: "Linux下使用cron定时执行脚本备份数据库"
published: 2020-05-28
description: "这里还有一篇MySQL数据库备份的10个教程 有兴趣的自行尝试"
tags: ["Linux"]
category: "Linux"
draft: false
lang: zh_CN
---

- 先上脚本

  ```sh
  #!/bin/sh

  #备份目录
  dic="/opt/mysql/DBbackup"
  y=$(date +%Y)
  m=$(date +%m)
  d=$(date +%d)
  time=$y$m$d

  day7=$(date +%Y%m%d --date '7 days ago')
  day14=$(date +%Y%m%d --date '14 days ago')

  tar7_name="mysql_backup_"$day7".sql.gz"
  tar14_name="mysql_backup_"$day14".sql.gz"

  # oss endPoint 用你自己的
  ossdir=oss://db-backup

  #备份前一天数据库
  printf  "\n%-8s备份数据库开始\n"
  mysqldump -uroot -proot --all-databases |gzip > ${dic}/"mysql_backup_"${time}".sql.gz"
  printf "%-15s休眠60秒 等待全部数据库压缩备份\n"
  sleep 60
  printf "%-15s休眠结束\n"
  printf "%-8s备份数据库结束\n\n"

  #上传7天前的.tar.gz文件到oss
  printf "%-8s上传7天前的.sql.gz文件开始\n"
  if test -e ${dic}/${tar7_name}
  then
  	printf "%-15s"${tar7_name}"文件存在 准备上传\n"
  	/home/ossutil -f cp ${dic}/${tar7_name} ${ossdir}
  	printf "%-15s上传的文件全路径为:"${dic}/${tar7_name}"\n"
  	printf "%-15s休眠60秒 等待OSS文件上传\n"
  	sleep 60
  	printf "%-15s休眠结束\n"
  	printf "%-15s上传7天前的.sql.gz文件结束\n"
  else
  	printf "%-15s"${dic}/${tar7_name}"文件不存在\n"
  fi
  printf "%-8s上传7天前的.sql.gz文件结束\n\n"

  #删除14天前已上传的.sql.gz文件
  printf "%-8s删除14天前已上上传的.sql.gz文件开始\n"
  exit=`/home/ossutil stat ${ossdir}/${tar14_name}|grep 'does not exist'|wc -l`
  if [  $exit -eq 1 ]
  then
  	printf "%-15s"${tar14_name}"文件在OSS上不存在\n"
  	printf "%-15s查看本地是否存在14天前的.sql.gz文件\n"
  	if test -e ${dic}/${tar14_name}
  	then
  		printf "%-15s14天前的"${dic}/${tar14_name}"文件依然存在 准备重新上传\n"
  		/home/ossutil -f cp ${dic}/${tar14_name} ${ossdir}
  		printf "%-15s上传的文件全路径为:"${dic}/${tar14_name}
  		printf "%-15s休眠60秒 等待OSS文件上传\n"
  		sleep 60
  		printf "%-15s休眠结束\n"
  		printf "%-15s重新上传14天前的.sql.gz文件完成\n"
  	else
  		printf "%-15s14天前的"${dic}/${tar14_name}"文件在本地也不存在\n"
  	fi
  else
  	if test -e ${dic}/${tar14_name}
  	then
  		printf "%-15s"${ossdir}"上已存在mysql_backup_"${day14}"文件 该文件即将删除\n"
  		rm -rf ${dic}/${tar14_name}
  		printf "%-15s文件删除成功 被删文件全路径:"${dic}/${tar14_name}"\n"
  	else
  		printf "%-15s14天前的"${dic}/${tar14_name}"文件在本地不存在 不执行删除操作\n"
  	fi
  fi
  printf "%-8s删除14天前已上传的.sql.gz文件结束\n\n"
  ```

- 设置corn

  ```shell
  crontab -e
  0 2 * * * /bin/bash /opt/dbbackup.sh > /dev/null
  # cron解释 每天凌晨两点执行/opt/dbbackup.sh脚本 并且不输出日志
  # > /dev/null意思是输出到空 不写的话会以日志的形式保存在/var/log/{执行cron的用户}目录下 比如/var/log/root
  ```

  ```shell
  # 表达式的意义:
  # .---------------- 分 (0 - 59)
  # |  .------------- 时 (0 - 23)
  # |  |  .---------- 月的某天 (1 - 31)
  # |  |  |  .------- 月 (1 - 12)
  # |  |  |  |  .---- 周的某天 (0 - 6) (0或7为周日)
  # |  |  |  |  |
  # *  *  *  *  * user-name  command to be executed
  ```

- 启动(二选一)

  ```shell
  service crond start
  /etc/rc.d/init.d/crond start
  ```

- 其它命令
  - 重启（二选一）

    ```shell
    service crond restart
    /etc/rc.d/init.d/crond restart
    ```

  - 停止（二选一）

    ```shell
    service crond stop
    /etc/rc.d/init.d/crond stop
    ```

  - 查看状态（二选一）

    ```shell
    service crond status
    /etc/rc.d/init.d/crond status
    ```

  - 重载配置（二选一）

    ```shell
    service crond reload
    /etc/rc.d/init.d/crond reload
    ```

  - crontab选项

    ```shell
    crontab –e  : 修改 crontab 文件, 如果文件不存在会自动创建。
    crontab –l  : 显示 crontab 文件。
    crontab -r  : 删除 crontab 文件。
    crontab -ir : 删除 crontab 文件前提醒用户
    ```

[这里还有一篇MySQL数据库备份的10个教程 有兴趣的自行尝试](https://www.linuxde.net/2012/03/9379.html)

