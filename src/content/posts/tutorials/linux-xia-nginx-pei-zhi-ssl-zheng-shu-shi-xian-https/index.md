---
title: "Linux下nginx配置SSL证书实现https"
published: 2026-01-05
description: "域名.crt文件"
tags: ["Nginx","Linux"]
category: "Nginx"
draft: false
lang: zh_CN
---

#### 1.前提

- 先准备SSL证书 途径很多 收费的免费的

#### 2.安装nginx 需要ssl模块

- [安装全新的nginx](http://www.tianch.xyz/archives/linux%E7%BC%96%E8%AF%91%E5%AE%89%E8%A3%85nginx)

- 之前已经安装了nginx，但是没有ssl模块
  - 查看之前的nginx有没有安装ssl模块(http_ssl_module)

    ```shell
    /opt/nginx/sbin/nginx -V
    ```

  - 如果没有安装 用源码重新编译一个新的nginx 其它配置要和你之前编译的一样 避免出现一些问题

    ```shell
    # 加入http_ssl_module
    --with-http_ssl_module
    # 重新make
    #注意这里只能用make 千万不要用make install，因为执行make install是覆盖安装的意思
    ```

  - 将编译完的nginx文件替换之前的nginx文件 注意备份之前的nginx文件 别直接覆盖

#### 3.上传证书到服务器nginx目录下

- 创建ssl文件夹和密码文件（ssl.pass文件的作用：不用每次reload或者启动都要手动输入密码）

  ```shell
  mkdir -p /opt/nginx/ssl
  cd /opt/nginx/ssl
  touch ssl.pass
  #将证书密码写入ssl.pass文件 注意首尾空格和换行
  ```

- 上传证书到ssl文件夹

  域名.crt文件

  域名.key文件

#### 4.配置nginx配置文件 以9090为例

- 先配置http

```shell
server {
	listen       9090;
    server_name  xxx.com;

    location / {
        proxy_connect_timeout 60;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header REMOTE-HOST $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

- 再配置https

  ```shell
      # HTTPS server
      server {
          listen       443 ssl;
          server_name  xxx.com;

          ssl_certificate      /opt/nginx/ssl/xxx.com.crt;
          ssl_certificate_key  /opt/nginx/ssl/xxx.com.key;

          ssl_session_cache    shared:SSL:1m;
          ssl_session_timeout  5m;

          ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE:ECDH:AES:HIGH:!NULL:!aNULL:!MD5:!ADH:!RC4;
          ssl_protocols TLSv1 TLSv1.1 TLSv1.2;
          ssl_prefer_server_ciphers on;
          ssl_password_file /opt/nginx/ssl/ssl.pass;

          location / {
              proxy_connect_timeout 45;
              proxy_send_timeout 45;
              proxy_read_timeout 45;
              proxy_set_header Host $host;
              proxy_set_header X-Real-IP $remote_addr;
              proxy_set_header REMOTE-HOST $remote_addr;
              proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
              proxy_pass http://127.0.0.1:9090;
          }
     }
  ```

#### 5.测试配置的正确性

```shell
/opt/nginx/sbin/nginx -t
```

#### 6.重新加载配置文件

```shell
/opt/nginx/sbin/nginx -s reload
```

