#ifndef INPUT_HPP
#define INPUT_HPP

#include <cstdio>
#include <cstdlib>
#include <cstring>

class InputMsg
{
public:
    enum { max_length = 10 };

    InputMsg()
        : _length(0)
    {
    }

    char* data()
    {
        return data_;
    }

    size_t length() const
    {
        return _length;
    }

    void length(size_t new_length)
    {
        _length = new_length;
        if (_length > max_length)
            _length = max_length;
    }

private:
    char data_[max_length];
    size_t _length;
};

#endif // INPUT_HPP
