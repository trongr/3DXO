#ifndef TILE_HPP
#define TILE_HPP

#include <memory>
#include "unit.hpp"

class Tile {
public:

    Tile();
    Tile(std::vector<int> xyz);
    ~Tile();

    std::vector<int> getXYZ() const { return xyz; }

    void setUnit(std::shared_ptr<Unit> u){ unit = u; }
    void removeUnit(){ unit = nullptr; } // mach move this pointer to another tile
    void destroyUnit(){ unit = nullptr; }
    bool isEmpty(){ return unit == nullptr; }

private:

    std::vector<int> xyz;
    std::shared_ptr<Unit> unit;

};

#endif // TILE_HPP
