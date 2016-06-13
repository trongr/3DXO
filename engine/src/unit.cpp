#include "unit.hpp"

using namespace std;

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

Unit::Unit(int unitID, std::string playerID, Type type, std::vector<int> xyz):
    id(unitID),
    playerID(playerID),
    type(type),
    xyz(xyz)
{

}

Unit::~Unit(){

}
