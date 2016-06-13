#ifndef UNIT_HPP
#define UNIT_HPP

#include <memory>
#include <vector>
#include <unordered_map>
#include <map>

class Unit: public std::enable_shared_from_this<Unit> {
public:

    enum Type {
        PAWN, ROOK, KNIGHT, BISHOP, QUEEN, KING, CANNON
    }; static std::map<Type, const char*> TypeStrings;

    Unit();
    ~Unit();
    Unit(int unitID, std::string playerID, Type type, std::vector<int> xyz);

    int getID(){ return id; }
    Type getType(){ return type; }
    std::vector<int> getXYZ() const { return xyz; }

private:

    int id;
    std::string playerID;
    Type type;
    std::vector<int> xyz;

};

#endif // UNIT_HPP
