#!/bin/bash

cd ~
wget http://downloads.sourceforge.net/project/boost/boost/1.61.0/boost_1_61_0.tar.bz2
tar xfv boost_1_61_0.tar.bz2
cd boost_1_61_0

# only build necessary libs to save build time.
# use $(HOME)/ and $(HOME)/lib for your include and lib paths during compilation.
./bootstrap.sh --prefix=$HOME --with-libraries=\
system,\
regex,\
thread

./b2 --prefix=$HOME \
--with-system \
--with-regex \
--with-thread \
threading=multi install

# Add the Boost libraries path to the default Ubuntu library search path
sudo /bin/bash -c 'echo "/usr/local/lib" > /etc/ld.so.conf.d/boost.conf'
# Update the default Ubuntu library search paths
sudo ldconfig
