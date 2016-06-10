#ifndef UNIT_HPP
#define UNIT_HPP

#include <memory>
#include <unordered_map>

class Unit: public std::enable_shared_from_this<Unit> {
public:

    Unit();
    ~Unit();
    Unit(int playerID, std::string type, std::vector<int> xyz);

    int getID(){ return id; }
    std::string getType(){ return type; }
    std::vector<int> getXYZ() const { return xyz; }

private:

    static int curID; // increasing unit ID
    static std::unordered_map<int, std::shared_ptr<Unit>> index;

    int id;
    int playerID;
    std::string type;
    std::vector<int> xyz;

};

#endif // UNIT_HPP
