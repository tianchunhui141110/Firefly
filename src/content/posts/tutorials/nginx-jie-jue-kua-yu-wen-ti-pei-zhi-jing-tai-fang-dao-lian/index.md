---
title: "Nginx解决跨域问题、配置静态防盗链"
published: 2021-07-12
description: "跨域问题的解决"
tags: ["Nginx"]
category: "Nginx"
draft: false
lang: zh_CN
---

- 
跨域问题的解决

现象
location / {
    #允许带上cookie请求
	add_header 'Access-Control-Allow-Credentials' 'true';
    #允许跨域请求的域，*代表所有
    add_header Access-Control-Allow-Origin *; 
    #允许请求的方法，比如 GET/POST/PUT/DELETE
    add_header Access-Control-Allow-Methods 'GET, POST, OPTIONS'; 
    #允许请求的header
    add_header Access-Control-Allow-Headers '*';
}
`

- 
设置静态资源防盗链

配置一个静态资源

server {
    listen       81;
    server_name  localhost;

    location /img {	

        root   html;
        index  index.html index.htm;
    }
}
`
未开启防盗链效果
server {
    listen       81;
    server_name  localhost;

    location /img {

        #对源站点验证
        valid_referers *.tianch.xyz;
        #非法引入会进入下方判断
        if ($invalid_referer) {
            return 403;
        }

        root   html;
        index  index.html index.htm;
    }
}
`
开启防盗链效果
