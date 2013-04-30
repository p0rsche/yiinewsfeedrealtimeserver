Yii Newsgeed Realtime server
-------------------------

Installing redis:

Unpack, go to sources root and do:

make
make install

(you can use 'make PREFIX=/some/other/directory install' to install in non-standard location)
Also there is useful init scripts under 'utils' directory. You can use 'em on Debian-based systems.

You can use my redis config.

***

Installing phpredis

phpize
./configure
make && make install

make install copies redis.so to an appropriate location, but you still need to enable the module in the PHP config file. To do so, either edit your php.ini or add a redis.ini file in /etc/php5/conf.d with the following contents: 

extension=redis.so.

You can generate a debian package for PHP5, accessible from Apache 2 by running ./mkdeb-apache2.sh or with dpkg-buildpackage or svn-buildpackage.

***

Installing node:

Unpack, go to sources root and do:

./configure
make
make install

(you may also use PREFIX to install in non-standard location).

***

Installing npm (node package manager):

Since node v.0.6.15, npm comes with node
So it is available after node compiling by using:

node npm <actions>

(npm is located near node binaries and it's symbolic link to cli.js itself)

