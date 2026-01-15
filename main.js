console.log('MAIN.JS LOADED');
console.log('THREE available?', typeof window.THREE);

if (!window.THREE) {
  console.error('THREE.js is not loaded!');
  document.body.innerHTML = '<h1 style="color:red;">THREE.js failed to load</h1>';
} else {
  console.log('THREE.js version:', THREE.REVISION);

  // ============================================
  // CARD CLASS
  // ============================================
  class Card {
    constructor(config) {
      this.index = config.index;
      this.width = config.width;
      this.height = config.height;
      this.frontTexturePath = config.frontTexturePath;
      this.backColor = config.backColor || null;
      this.backTexturePath = config.backTexturePath || null;
      this.hasThickness = config.hasThickness || false;
      this.thickness = 0.05;
      
      // State
      this.isFrontFacing = true;
      this.isLoaded = false;
      
      // Animation targets
      this.targetPosition = new THREE.Vector3(0, 0, 0);
      this.targetRotationX = 0;
      this.targetRotationY = 0;
      this.hoverRotationY = 0;  // Separate from flip rotation
      this.targetScale = new THREE.Vector3(1, 1, 1);
      
      // THREE.js objects
      this.group = new THREE.Group();
      this.frontMesh = null;
      this.backMesh = null;
      
      // Animation settings
      this.animationSpeed = 0.1;
    }
    
    load(textureLoader) {
      return new Promise((resolve, reject) => {
        console.log('Loading card', this.index, 'from', this.frontTexturePath);
        
        // Load front texture first
        textureLoader.load(
          this.frontTexturePath,
          (frontTexture) => {
            console.log('Card', this.index, 'front texture loaded successfully');
            
            // Function to complete card creation once we have back texture/material
            const createCard = (backMaterial, backTexture) => {
              const geometry = new THREE.PlaneGeometry(this.width, this.height);
              
              // Create front material
              const frontMaterial = new THREE.MeshStandardMaterial({
                map: frontTexture,
                transparent: true,
                alphaTest: 0.5,
                depthWrite: true
              });
              
              // Custom depth material for alpha-aware shadows on front
              const frontDepthMaterial = new THREE.MeshDepthMaterial({
                depthPacking: THREE.RGBADepthPacking,
                map: frontTexture,
                alphaTest: 0.5
              });
              
              // Create meshes
              this.frontMesh = new THREE.Mesh(geometry, frontMaterial);
              this.frontMesh.castShadow = true;
              this.frontMesh.receiveShadow = true;
              this.frontMesh.customDepthMaterial = frontDepthMaterial;
              this.frontMesh.position.z = this.hasThickness ? this.thickness / 2 : 0;
              this.group.add(this.frontMesh);
              
              this.backMesh = new THREE.Mesh(geometry, backMaterial);
              this.backMesh.castShadow = true;
              this.backMesh.receiveShadow = true;
              // Add custom depth material for back if it has a texture with alpha
              if (backTexture) {
                const backDepthMaterial = new THREE.MeshDepthMaterial({
                  depthPacking: THREE.RGBADepthPacking,
                  map: backTexture,
                  alphaTest: 0.5
                });
                this.backMesh.customDepthMaterial = backDepthMaterial;
              }
              this.backMesh.rotation.y = Math.PI;
              this.backMesh.position.z = this.hasThickness ? -this.thickness / 2 : -0.02;
              this.group.add(this.backMesh);
              
              // Add thickness edges if needed
              if (this.hasThickness && this.backColor) {
                this.addEdges();
              }
              
              // Set render order
              this.group.renderOrder = this.index;
              
              this.isLoaded = true;
              console.log('Card', this.index, 'meshes created, group children:', this.group.children.length);
              resolve(this);
            };
            
            // Load back texture or use solid color
            if (this.backTexturePath) {
              textureLoader.load(
                this.backTexturePath,
                (backTexture) => {
                  console.log('Card', this.index, 'back texture loaded');
                  const backMaterial = new THREE.MeshStandardMaterial({
                    map: backTexture,
                    transparent: true,
                    alphaTest: 0.5,
                    depthWrite: true
                  });
                  createCard(backMaterial, backTexture);
                },
                undefined,
                (error) => {
                  console.error('Failed to load back texture for card', this.index, ':', error);
                  reject(error);
                }
              );
            } else {
              // Use solid color
              const backTexture = this.createSolidColorTexture(this.backColor);
              const backMaterial = new THREE.MeshStandardMaterial({
                map: backTexture,
                transparent: true,
                alphaTest: 0.5,
                depthWrite: true
              });
              createCard(backMaterial, null);
            }
          },
          undefined,
          (error) => {
            console.error('Failed to load texture for card', this.index, ':', error);
            reject(error);
          }
        );
      });
    }
    
    addEdges() {
      const edgeMaterial = new THREE.MeshStandardMaterial({ color: this.backColor });
      
      // Top edge
      const topGeom = new THREE.BoxGeometry(this.width, this.thickness, this.thickness);
      const topEdge = new THREE.Mesh(topGeom, edgeMaterial);
      topEdge.position.set(0, this.height / 2, 0);
      topEdge.castShadow = true;
      this.group.add(topEdge);
      
      // Bottom edge
      const bottomEdge = new THREE.Mesh(topGeom, edgeMaterial);
      bottomEdge.position.set(0, -this.height / 2, 0);
      bottomEdge.castShadow = true;
      this.group.add(bottomEdge);
      
      // Left edge
      const sideGeom = new THREE.BoxGeometry(this.thickness, this.height, this.thickness);
      const leftEdge = new THREE.Mesh(sideGeom, edgeMaterial);
      leftEdge.position.set(-this.width / 2, 0, 0);
      leftEdge.castShadow = true;
      this.group.add(leftEdge);
      
      // Right edge
      const rightEdge = new THREE.Mesh(sideGeom, edgeMaterial);
      rightEdge.position.set(this.width / 2, 0, 0);
      rightEdge.castShadow = true;
      this.group.add(rightEdge);
    }
    
    createSolidColorTexture(hexColor) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = hexColor;
      ctx.fillRect(0, 0, 256, 256);
      return new THREE.CanvasTexture(canvas);
    }
    
    flip() {
      this.isFrontFacing = !this.isFrontFacing;
      this.targetRotationY = this.isFrontFacing ? 0 : Math.PI;
    }
    
    setPosition(x, y, z) {
      this.targetPosition.set(x, y, z);
    }
    
    setScale(scale) {
      this.targetScale.set(scale, scale, scale);
    }
    
    setHoverTilt(mouseX, mouseY) {
      this.targetRotationX = mouseY * 0.2;
      this.hoverRotationY = mouseX * 0.2;
    }
    
    update() {
      if (!this.isLoaded) return;
      
      // Smooth position animation
      this.group.position.lerp(this.targetPosition, this.animationSpeed);
      
      // Smooth scale animation
      this.group.scale.lerp(this.targetScale, this.animationSpeed);
      
      // Smooth rotation animation
      // Combine flip rotation (targetRotationY) with hover rotation (hoverRotationY)
      const totalTargetY = this.targetRotationY + this.hoverRotationY;
      this.group.rotation.y += (totalTargetY - this.group.rotation.y) * this.animationSpeed;
      this.group.rotation.x += (this.targetRotationX - this.group.rotation.x) * this.animationSpeed;
    }
    
    addToScene(scene) {
      scene.add(this.group);
    }
  }

  // ============================================
  // VIEW CLASSES
  // ============================================
  class BaseView {
    constructor(app) {
      this.app = app;
    }
    
    enter() {
      // Override in subclasses
    }
    
    exit() {
      // Override in subclasses
    }
    
    update() {
      // Override in subclasses
    }
    
    onCardClick(cardIndex) {
      // Override in subclasses
    }
    
    onBlankClick() {
      // Override in subclasses
    }
  }

  class StackView extends BaseView {
    enter() {
      console.log('Entering StackView');
      const cards = this.app.cards;
      const spacing = 0.15;
      
      for (let i = 0; i < cards.length; i++) {
        // Card 0 in front (highest Z), card 4 in back
        cards[i].setPosition(0, 0, (cards.length - 1 - i) * spacing);
        cards[i].setScale(1);
      }
    }
    
    update() {
      // Apply hover tilt to ALL cards so they move together as a unit
      const cards = this.app.cards;
      for (const card of cards) {
        card.setHoverTilt(this.app.mouseX, this.app.mouseY);
      }
    }
    
    onCardClick(cardIndex) {
      this.app.setView('spread');
    }
    
    onBlankClick() {
      // Do nothing in stack view
    }
  }

  class SpreadView extends BaseView {
    enter() {
      console.log('Entering SpreadView');
      const cards = this.app.cards;
      const horizontalSpacing = 4;
      const startX = -(cards.length - 1) * horizontalSpacing / 2;
      
      for (let i = 0; i < cards.length; i++) {
        const xPos = startX + i * horizontalSpacing;
        cards[i].setPosition(xPos, 0, i * 0.1);
        cards[i].setScale(0.8);
      }
    }
    
    update() {
      // Apply hover tilt to all cards
      for (const card of this.app.cards) {
        card.setHoverTilt(this.app.mouseX, this.app.mouseY);
      }
    }
    
    onCardClick(cardIndex) {
      this.app.selectedCardIndex = cardIndex;
      this.app.setView('focus');
    }
    
    onBlankClick() {
      this.app.setView('stack');
    }
  }

  class FocusView extends BaseView {
    enter() {
      console.log('Entering FocusView, selected:', this.app.selectedCardIndex);
      const cards = this.app.cards;
      const selectedIndex = this.app.selectedCardIndex;
      
      // Position focused card in center
      cards[selectedIndex].setPosition(0, 0, 2);
      cards[selectedIndex].setScale(1.3);
      
      // Stack other cards at bottom of screen
      const stackSpacing = 0.1;
      let stackIndex = 0;
      for (let i = 0; i < cards.length; i++) {
        if (i !== selectedIndex) {
          // Position at bottom, stacked with small z offset
          cards[i].setPosition(0, -4, -2 + stackIndex * stackSpacing);
          cards[i].setScale(0.5);
          // Reset any hover tilt
          cards[i].setHoverTilt(0, 0);
          stackIndex++;
        }
      }
    }
    
    update() {
      // Apply hover tilt to selected card only
      const selectedCard = this.app.cards[this.app.selectedCardIndex];
      if (selectedCard) {
        selectedCard.setHoverTilt(this.app.mouseX, this.app.mouseY);
      }
      
      // Keep other cards without tilt (reset each frame)
      for (let i = 0; i < this.app.cards.length; i++) {
        if (i !== this.app.selectedCardIndex) {
          this.app.cards[i].setHoverTilt(0, 0);
        }
      }
    }
    
    onCardClick(cardIndex) {
      // Flip the selected card
      const selectedCard = this.app.cards[this.app.selectedCardIndex];
      if (selectedCard) {
        selectedCard.flip();
      }
    }
    
    onBlankClick() {
      this.app.setView('spread');
    }
  }

  // ============================================
  // APP CLASS
  // ============================================
  class App {
    constructor() {
      console.log('App constructor starting...');
      
      // Scene setup
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      this.camera.position.z = 8;
      
      const canvas = document.getElementById('mycanvas');
      console.log('Canvas element:', canvas);
      
      this.renderer = new THREE.WebGLRenderer({ canvas: canvas });
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setClearColor(0xd4c4a8);  // More brown background
      this.renderer.setClearAlpha(1);
      this.renderer.sortObjects = true;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      
      // Add lighting for shadows
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      this.scene.add(ambientLight);
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(5, 10, 7);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      directionalLight.shadow.camera.near = 0.5;
      directionalLight.shadow.camera.far = 50;
      directionalLight.shadow.camera.left = -10;
      directionalLight.shadow.camera.right = 10;
      directionalLight.shadow.camera.top = 10;
      directionalLight.shadow.camera.bottom = -10;
      this.scene.add(directionalLight);
      
      // Add a plane to receive shadows
      const shadowPlaneGeom = new THREE.PlaneGeometry(50, 50);
      const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.3 });
      const shadowPlane = new THREE.Mesh(shadowPlaneGeom, shadowPlaneMat);
      shadowPlane.position.z = -5;
      shadowPlane.receiveShadow = true;
      this.scene.add(shadowPlane);
      
      console.log('Renderer created, size:', window.innerWidth, 'x', window.innerHeight);
      
      // Input state
      this.mouseX = 0;
      this.mouseY = 0;
      this.raycaster = new THREE.Raycaster();
      this.mouse = new THREE.Vector2();
      
      // Cards
      this.cards = [];
      this.selectedCardIndex = null;
      
      // Views
      this.views = {
        stack: new StackView(this),
        spread: new SpreadView(this),
        focus: new FocusView(this)
      };
      this.currentView = null;
      
      // Texture loader
      this.textureLoader = new THREE.TextureLoader();
      
      // Setup input handlers
      this.setupInputHandlers();
    }
    
    setupInputHandlers() {
      // Mouse move
      window.addEventListener('mousemove', (e) => {
        this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
      });
      
      // Click
      window.addEventListener('click', (e) => this.handleClick(e));
      
      // Resize
      window.addEventListener('resize', () => {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
      });
    }
    
    handleClick(e) {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      
      this.raycaster.setFromCamera(this.mouse, this.camera);
      
      // Get all card groups
      const cardGroups = this.cards.map(card => card.group);
      const intersects = this.raycaster.intersectObjects(cardGroups, true);
      
      if (intersects.length > 0) {
        // Find which card was clicked
        let clickedCardIndex = -1;
        let obj = intersects[0].object;
        
        while (obj && clickedCardIndex === -1) {
          for (let i = 0; i < this.cards.length; i++) {
            if (this.cards[i].group === obj) {
              clickedCardIndex = i;
              break;
            }
          }
          obj = obj.parent;
        }
        
        if (clickedCardIndex >= 0 && this.currentView) {
          this.currentView.onCardClick(clickedCardIndex);
        }
      } else {
        if (this.currentView) {
          this.currentView.onBlankClick();
        }
      }
    }
    
    async loadCards(cardConfigs) {
      const loadPromises = cardConfigs.map((config, index) => {
        const card = new Card({
          index: index,
          width: config.width,
          height: config.height,
          frontTexturePath: config.front,
          backTexturePath: config.back || null,
          backColor: config.backColor || null,
          hasThickness: config.hasThickness || false
        });
        return card.load(this.textureLoader);
      });
      
      this.cards = await Promise.all(loadPromises);
      
      // Add cards to scene
      for (const card of this.cards) {
        card.addToScene(this.scene);
      }
      
      console.log('All cards loaded:', this.cards.length);
    }
    
    setView(viewName) {
      if (this.currentView) {
        this.currentView.exit();
      }
      
      this.currentView = this.views[viewName];
      
      if (this.currentView) {
        this.currentView.enter();
      }
    }
    
    update() {
      // Update current view
      if (this.currentView) {
        this.currentView.update();
      }
      
      // Update all cards
      for (const card of this.cards) {
        card.update();
      }
    }
    
    render() {
      this.renderer.render(this.scene, this.camera);
    }
    
    run() {
      const animate = () => {
        requestAnimationFrame(animate);
        this.update();
        this.render();
      };
      animate();
    }
  }

  // ============================================
  // INITIALIZE APP
  // ============================================
  const app = new App();
  
  // Card configurations
  const cardConfigs = [
    { front: 'assets/cards/card1-front.png', back: 'assets/cards/card1-back.png', width: 3, height: 3 },
    { front: 'assets/cards/card2-front-1.png', back: 'assets/cards/card2-back-1.png', width: 3, height: 3 },
    { front: 'assets/cards/card3-front.png', backColor: '#fbf9f1', width: 3.49, height: 3.49, hasThickness: true },
    { front: 'assets/cards/card4-front.png', backColor: '#ffffff', width: 3.82, height: 3.82, hasThickness: true },
    { front: 'assets/cards/card5-front.png', backColor: '#ffcb87', width: 4.03, height: 5.73, hasThickness: true }
  ];
  
  // Load cards and start
  app.loadCards(cardConfigs).then(() => {
    app.setView('stack');
    app.run();
    console.log('App started!');
  }).catch((error) => {
    console.error('Error loading cards:', error);
  });
  
  // Start rendering immediately even before cards load
  app.run();
}






