---
title: "Nginx设置keepalive提升吞吐量"
published: 2021-07-14
description: "nginx 使用反向代理时 保持长连接"
tags: ["Nginx"]
category: "Nginx"
draft: false
lang: zh_CN
---

- 在 `nginx` 中, 对于 http1.0 和 http1.1 是支持长连接的, http 请求是基于 tcp 协议之上的, 那么当客户端发起请求前, 需要先与服务器建立 tcp 连接, 而每次的 tcp 连接是需要三次握手来确定的, 如果客户端与服务端之间的网络差了一点, 那么这三次握手的时间消耗就比较多, 同时也会带来不必要的流量消耗,当然断开连接还要有四次的挥手端开的交互;

- 在 HTTP 协议中, 请求是请求与应答的模式, 如果我们可以在一个连接上; 响应多个请求, 那么这个就是所谓的长连接;

- 我们来看看 HTTP协议在响应的主体 body 的长度的描述

- http1.0: 如果请求中有 Content-Length 头, 则以 Content-length 的数值作为 body的长度, 客户端在接收完 body 时, 就可以依照这个长度来接收数据, 接收完就表示这个请求完成了, 如果没有这个字段来标示, 那么客户端会一直接收数据, 直到服务器主动关闭连接

- http1.1: 如果响应头中的 Transfer-encoding 为 chunked 传输, 则表示 body 是流式传输, body 会被分割为多个 chunk; 每个chunk的开始会标识出当前块的长度, 此时body 不需要通过长度来制定了, 如果是非chunked 传输, 而且有content-length 的字段, 那么就会按照这个字段的长度来接收数据, 如果不是 chunked, 又没有 Content-length 这个字段, 那么就会一直接收到服务器主动关闭连接

- 当服务器传输完 body 之后, 会考虑使用`长连接`, 能否使用短连接, 也有条件限制, 如果客户端的请求头中的 connection 为 close; 则标识客户端需要关闭长连接, 如果为 keep-alive; 则客户端需要打开长连接, 如果请求头中没有这个字段, 根据协议: 1.0 默认为 close; 1.1 默认为 keep-alive; 那么nginx 在传输完响应体后, 会设置当前连接的 keepalive 属性, 然后等待客户端下一次请求, 当然 nginx 不可能会一直的等待, 当 nginx 设置 keepalive 等待下一次的请求时, 会设置一个最大的等待时间, 通过 keepalive_timeout 来配置, 如果配置为 0 ; 则表示关闭 keepalive; 此时 http 版本不管是 1.0, 还是 1.1; 客户端的 connection 不管是 close 还是 keepalive; 都会强制设置为 close

- 如果 connection 为 close; 那么在 nginx 响应完数据后, 会主动关闭连接, 那么对请求比较大的 nginx 来说, 关掉 keepalive 最后会产生比较多的 time-wait 状态的 socket; 一般来说, 当客户端的一次访问, 需要多次访问同一个 server 时, 打开 keepalive 的优势非常大

nginx 使用反向代理时 保持长连接

长连接的优势就是在一个 tcp 连接上可以传输多个 HTTP 请求, 减少建立连接和关闭连接的消耗和延迟

- 当 nginx 作为反向代理时

- 
从 Client 到 Nginx 的连接是长连接 \

```nginx
http {
    # 客户端连接的超时时间, 为 0 时禁用长连接,
    keepalive_timeout 120s;
    # 在一个长连接上可以服务的最大请求数目, 当达到最大请求数目且所有已有请求结束后, 连接被关闭, 默认为 100, 即每个连接的最大请求数
    keepalive_request 10000;
}

```

- 
Nginx 到 Server(upstream) 的长连接

```nginx
upstream mytest {
    server 192.168.0.1:8080 weight=1 max_fails=2 fail_timeout=30s;
    server 192.168.0.2:8080 weight=1 max_fails=2 fail_timeout=30s;
    # 这个参数非常重要
    keepalive 300
}

```

```nginx
server {
    listen 80;
    server_name www.tianch.xyz;
    location / {
        proxy_pass http://mytest;
        proxy_http_version 1.1;
     proxy_set_header Connection "";
    }
}

```

keepalive: 这个参数是 nginx 连接后端的连接池中的最大空闲连接数, 比如: 设置为 300; 如果 nginx 为了满足请求的 qps; 创建了 1000 个连接的连接池, 这个时候只有 500 个请求多来, 那么 1000- 500 = 500; 那么就会多出 500 个空闲的连接, 那么 500 > 300; 那么 nginx 就会根据这个配置; 断开 200 个请求连接; 那么这个时候就只有 800 个连接的连接池, 如果下次过来了 1000 个请求, 那么 nginx 又会开始创建连接; 所有这个数值的配置要小心配置

参考链接：https://www.jianshu.com/p/394a7883a139
