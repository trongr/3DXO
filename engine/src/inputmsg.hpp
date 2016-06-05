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

    char* getBuf(){
        return buf;
    }

    const char* getData(){
        return msg.c_str();
    }

    // pushes buffer content to msg
    void push(size_t length){
        buf[length] = '\0';
        msg.append(buf);
    }

    // clears msg for next user input
    void flush(){
        msg = "";
    }

private:
    string msg;
    char buf[max_length + 1]; // +1 for null terminator
};

#endif // INPUTMSG_HPP
