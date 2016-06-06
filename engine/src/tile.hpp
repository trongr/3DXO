#ifndef TILE_HPP
#define TILE_HPP

class Tile {
public:

    Tile(){

    }

    Tile(std::vector<int> xyz)
        : xyz(xyz){

    }

    ~Tile(){

    }

    std::vector<int> getXYZ(){
        return xyz;
    }

private:

    std::vector<int> xyz;

};

#endif // TILE_HPP
