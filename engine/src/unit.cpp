#include <vector>
#include <iostream>
#include "unit.hpp"

using namespace std;

int Unit::curID = 0;
std::unordered_map<int, std::shared_ptr<Unit>> Unit::index;

Unit::Unit(){

}

Unit::Unit(string type, std::vector<int> xyz):
    id(curID++),
    type(type),
    xyz(xyz)
{
    index[id] = shared_from_this();
}

Unit::~Unit(){

}
