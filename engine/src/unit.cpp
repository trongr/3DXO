#include "unit.hpp"

using namespace std;

int Unit::curID = 0;
std::unordered_map<int, std::shared_ptr<Unit>> Unit::index;
std::map<Unit::Type, const char*> Unit::TypeStrings = {
    {Unit::PAWN, "P"},
    {Unit::ROOK, "R"},
    {Unit::KNIGHT, "N"},
    {Unit::BISHOP, "B"},
    {Unit::QUEEN, "Q"},
    {Unit::KING, "K"},
    {Unit::CANNON, "C"}
};

Unit::Unit(){

}

Unit::Unit(int playerID, Type type, std::vector<int> xyz):
    id(curID++),
    playerID(playerID),
    type(type),
    xyz(xyz)
{
    index[id] = shared_from_this();
}

Unit::~Unit(){

}
