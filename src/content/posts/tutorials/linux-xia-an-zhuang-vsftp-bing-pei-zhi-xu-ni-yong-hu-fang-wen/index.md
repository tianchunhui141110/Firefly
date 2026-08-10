---
title: "Linux下安装vsftp并配置虚拟用户访问"
published: 2026-01-05
description: "添加下面的内容"
tags: ["Linux"]
category: "Linux"
draft: false
lang: zh_CN
---

1. 关闭防火墙

   ```shell
   systemctl stop firewalld
   systemctl disable firewalld
   ```

2. 本次会话关闭sellinux

   ```shell
   setenforce 0
   ```

3. 全局关闭sellinux

   ```shell
   vim /etc/selinux/config
   # 修改
   SELINUX=disabled
   ```

4. 查看

   ```shell
   getenforce
   ```

5. 安装vsftpd

   ```shell
   yum install -y vsftpd
   ```

6. 启动和设置自启动

   ```shell
   systemctl start vsftpd
   systemctl start vsftpd
   ```

7. 创建vsftpd使用的系统用户，主目录为/home/vsftpd，禁止ssh登录。创建之后所有虚拟用户使用这个系统用户访问文件。

   ```shell
   useradd vsftpd -d /home/vsftpd -s /bin/false
   ```

8. 创建虚拟用户主目录并设置权限

   ```shell
   mkdir -p /opt/www/webRoot
   chmod 777 -R /opt/www/webRoot
   ```

9. 创建一个或多个虚拟用户 用户名web 密码123456

   ```shell
   web
   123456
   ```

10. 根据这个文件创建数据库文件

    ```shell
    db_load -T -t hash -f /etc/vsftpd/loginusers.conf /etc/vsftpd/loginusers.db
    chmod 600 /etc/vsftpd/loginusers.db
    ```

11. 启用这个数据库文件

    ```shell
    vim /etc/pam.d/vsftpd
    #注释掉所有内容后，增加下面的内容
    auth    sufficient /lib64/security/pam_userdb.so db=/etc/vsftpd/loginusers
    account sufficient /lib64/security/pam_userdb.so db=/etc/vsftpd/loginusers
    ```

12. 创建虚拟用户配置文件

    ```shell
    mkdir /etc/vsftpd/userconf
    # 这里的文件名称必须与上面的虚拟用户名一致
    vim /etc/vsftpd/userconf/web
    ```

    添加下面的内容

    ```shell
    #/opt/www/webRoot/就是主目录文件
    local_root=/opt/www/webRoot/
    anon_world_readable_only=NO
    anon_upload_enable=YES
    anon_mkdir_write_enable=YES
    anon_other_write_enable=YES
    anon_umask=022
    ```

13. 修改 vsftp 主配置文件

    ```shell
    vim /etc/vsftpd/vsftpd.conf
    ```

    ```shell
    #更改 匿名不能访问
    anonymous_enable=NO

    #去掉注释 允许本地用户上传下载
    chroot_local_user=YES
    ascii_upload_enable=YES
    ascii_download_enable=YES

    # 增加
    listen_port=3321
    guest_enable=YES
    guest_username=vsftpd
    user_config_dir=/etc/vsftpd/userconf
    allow_writeable_chroot=YES
    ```

    - 配置介绍

      ```shell
      anonymous_enable=NO 禁止匿名用户登录
      chroot_local_user=YES 禁止用户访问除主目录以外的目录
      ascii_upload_enable=YES ascii_download_enable=YES 设定支持ASCII模式的上传和下载功能
      guest_enable=YES 启动虚拟用户
      guest_username=vsftpd 虚拟用户使用的系统用户名
      user_config_dir=/etc/vsftpd/userconf 虚拟用户使用的配置文件目录
      allow_writeable_chroot=YES 最新版的vsftpd为了安全必须用户主目录（也就是/opt/www/webRoot）没有写权限，才能登录，或者使用allow_writeable_chroot=YES
      ```

14. 重启使配生效

    ```shell
    systemctl restart vsftpd
    ```

