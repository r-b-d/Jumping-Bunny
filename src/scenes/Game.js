// https://photonstorm.github.io/phaser3-docs/Phaser.html

import Phaser from'../lib/phaser.js'

import Carrot from'../game/Carrot.js'

export default class Game extends Phaser.Scene
{
    /** @type {Phaser.Physics.Arcade.Sprite} */
    player

    /** @type {Phaser.Physics.Arcade.StaticGroup} */
    platforms

    /** @type {Phaser.Types.Input.Keyboard.CursorKeys} */
    cursors

    /** @type {Phaser.Physics.Arcade.Group} */
    carrots

    carrotsCollected = 0

    /** @type {Phaser.GameObjects.Text} */
    carrotsCollectedText

    constructor()
    {
        super('game')
    }

    // the init method is called by Phaser before preload
    init() 
    {
        this.carrotsCollected = 0 
    }

    preload()
    {
        this.load.image('background', 'assets/bg_layer1.png')
        // load the platform image
        this.load.image('platform', 'assets/ground_grass.png')

        this.load.image('bunny-stand', 'assets/bunny1_stand.png')

        this.load.image('bunny-jump', 'assets/bunny1_jump.png')

        this.load.image('carrot', 'assets/carrot.png')
        
        // use keyboard arrow keys
        this.cursors = this.input.keyboard.createCursorKeys()

        this.load.audio('jump', 'assets/sfx/phaseJump1.mp3')
    }

    create()
    {
        // Keep the Background from Scrolling
        this.add.image(240, 320, 'background').setScrollFactor(1, 0)
        
        // add a platform image in the middle
        // create the group
        this.platforms = this.physics.add.staticGroup()

        // then create 5 platforms from the group
        for (let i = 0; i < 5; ++i) {
            const x = Phaser.Math.Between(80, 400) 
            const y = 150 * i

            // use this.platforms here as well
            /** @type {Phaser.Physics.Arcade.Sprite} */
            const platform = this.platforms.create(x, y, 'platform')
            platform.scale = 0.5

            /** @type {Phaser.Physics.Arcade.StaticBody} */
            const body = platform.body
            body.updateFromGameObject()
        }
    
        // create a bunny sprite
        this.player = this.physics.add.sprite(240, 320, 'bunny-stand').setScale(0.5)
        this.physics.add.collider(this.platforms, this.player)

        this.player.body.checkCollision.up = false
        this.player.body.checkCollision.left = false
        this.player.body.checkCollision.right = false

        // follow the bunny as it jumps
        this.cameras.main.startFollow(this.player)

        // set the horizontal dead zone to 1.5x game width so the camera won't move to the left or right
        this.cameras.main.setDeadzone(this.scale.width * 1.5)

        // create a group of carrots
        this.carrots = this.physics.add.group({
                        classType: Carrot
        })
        
        // add this collider between carrot and platform
        this.physics.add.collider(this.platforms, this.carrots)

        //this.physics.add.collider(this.platforms, this.carrots)
        
        this.physics.add.overlap( this.player,
            this.carrots,
            this.handleCollectCarrot, // called on overlap 
            undefined,  // the undefined argument is for the process callback that we don’t need 
            this        // this is the Game Scene instance when the handleCollectCarrot method is called by Phaser
        )

        const style = { color: '#000', fontSize: 24 }
        this.carrotsCollectedText = this.add.text(240, 10, 'Carrots: 0', style)
            .setScrollFactor(0)
            .setOrigin(0.5, 0)
    }

    update()
    {
        this.platforms.children.iterate(child => {
            /** @type {Phaser.Physics.Arcade.Sprite} */ 
            const platform = child
            
            const scrollY = this.cameras.main.scrollY 
            if (platform.y >= scrollY + 700) {
                platform.y = scrollY - Phaser.Math.Between(50, 100)
                platform.body.updateFromGameObject()

                // create a carrot above the platform being reused
                this.addCarrotAbove(platform)
            }
        })

        this.carrots.children.each(child => {   // using each and not iterate as some children might be removed from the group
            /** @type {Phaser.Physics.Arcade.Sprite} */ 
            const carrot = child
            
            const scrollY = this.cameras.main.scrollY 
            if (carrot.y >= scrollY + 700) {
                // hide from display
                this.carrots.killAndHide(carrot)
                // disable from physics world
                this.physics.world.disableBody(carrot.body)

                this.carrots.remove(carrot)
            }
        })

        // find out from Arcade Physics if the player's physics body
        // is touching something below it
        const touchingDown = this.player.body.touching.down

        if (touchingDown) {
            // this makes the bunny jump straight up
            this.player.setVelocityY(-300)

            // switch to jump texture
            this.player.setTexture('bunny-jump')

            // play jump sound
            this.sound.play('jump')
        }

        const vy = this.player.body.velocity.y
        if (vy > 0 && this.player.texture.key !== 'bunny-stand') {
            // switch back to jump when falling
            this.player.setTexture('bunny-stand')
        }

        // left and right input logic
        if (this.cursors.left.isDown && !touchingDown) {
            this.player.setVelocityX(-200)
        } else if (this.cursors.right.isDown && !touchingDown) {
            this.player.setVelocityX(200)
        } else {
            // stop movement if not left or right
            this.player.setVelocityX(0)
        }

        this.horizontalWrap(this.player)

        // get the bottom most platform
        const bottomPlatform = this.findBottomMostPlatform()
        // check that the player is more than 200 pixels past the bottomPlatform
        if (this.player.y > bottomPlatform.y + 200) {
            this.scene.start('game-over')
        }
    }

    /*** @param {Phaser.GameObjects.Sprite} sprite */
    horizontalWrap(sprite)
    {
        const halfWidth = sprite.displayWidth * 0.5 
        const gameWidth = this.scale.width

        if (sprite.x < -halfWidth) {
            sprite.x = gameWidth + halfWidth
        } else if (sprite.x > gameWidth + halfWidth) {
            sprite.x = -halfWidth
        }
    }

    /*** @param {Phaser.GameObjects.Sprite} sprite */
    addCarrotAbove(sprite) 
    {    
        const y = sprite.y - sprite.displayHeight 

        /** @type {Phaser.Physics.Arcade.Sprite} */
        const carrot = this.carrots.get(sprite.x, y, 'carrot')

        // set active and visible
        carrot.setActive(true)
        carrot.setVisible(true)

        this.add.existing(carrot) 
        // update the physics body size
        carrot.body.setSize(carrot.width, carrot.height)

        // make sure body is enabed in the physics world
        this.physics.world.enable(carrot)

        return carrot
    }

    /**
    * @param {Phaser.Physics.Arcade.Sprite} player
    * @param {Carrot} carrot
    */
    handleCollectCarrot(player, carrot)
    {
        // hide from display
        this.carrots.killAndHide(carrot)
        // disable from physics world
        this.physics.world.disableBody(carrot.body)

        // increment by 1
        this.carrotsCollected++

        // create new text value and set it
        const value = `Carrots: ${this.carrotsCollected}`
        this.carrotsCollectedText.text = value
    }

    // We’ll be using the selection algorithm to find the platform with the highest y value to determine the bottom most platform.
    findBottomMostPlatform()
    {
        const platforms = this.platforms.getChildren()
        let bottomPlatform = platforms[0]
        
        for (let i = 1; i < platforms.length; ++i)
        {
            const platform = platforms[i]
        
            // discard any platforms that are above current
            if (platform.y < bottomPlatform.y) {
                continue
            }
        
            bottomPlatform = platform
        }
        
        return bottomPlatform
    }
}