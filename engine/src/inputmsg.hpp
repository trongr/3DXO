#ifndef INPUTMSG_HPP
#define INPUTMSG_HPP

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>

using namespace std;

class InputMsg {
public:
    enum { max_length = 10 };

    InputMsg(){

    }

    char* buf(){
        return _buf;
    }

    const char* data(){
        return _msg.c_str();
    }

    // pushes buffer content to _msg
    void push(size_t length){
        _buf[length] = '\0';
        _msg.append(_buf);
    }

    // clears _msg for next user input
    void flush(){
        _msg = "";
    }

private:
    string _msg;
    char _buf[max_length + 1]; // +1 for null terminator
};

#endif // INPUTMSG_HPP
