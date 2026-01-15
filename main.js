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
      this.backColor = config.backColor;
      
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
        textureLoader.load(
          this.frontTexturePath,
          (frontTexture) => {
            console.log('Card', this.index, 'texture loaded successfully');
          const geometry = new THREE.PlaneGeometry(this.width, this.height);
          
          // Create front material
          const frontMaterial = new THREE.MeshBasicMaterial({
            map: frontTexture,
            transparent: true,
            alphaTest: 0.5,
            depthWrite: true
          });
          
          // Create back material from solid color
          const backTexture = this.createSolidColorTexture(this.backColor);
          const backMaterial = new THREE.MeshBasicMaterial({
            map: backTexture,
            transparent: true,
            alphaTest: 0.5,
            depthWrite: true
          });
          
          // Create meshes
          this.frontMesh = new THREE.Mesh(geometry, frontMaterial);
          this.group.add(this.frontMesh);
          
          this.backMesh = new THREE.Mesh(geometry, backMaterial);
          this.backMesh.rotation.y = Math.PI;
          this.backMesh.position.z = -0.02;
          this.group.add(this.backMesh);
          
          // Set render order
          this.group.renderOrder = this.index;
          
          this.isLoaded = true;
          console.log('Card', this.index, 'meshes created, group children:', this.group.children.length);
          resolve(this);
          },
          undefined,
          (error) => {
            console.error('Failed to load texture for card', this.index, ':', error);
            reject(error);
          }
        );
      });
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
      this.renderer.setClearColor(0xf5f5dc);
      this.renderer.setClearAlpha(1);
      this.renderer.sortObjects = true;
      
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
          backColor: config.backColor
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
    { front: 'assets/cards/card1-front.png', backColor: '#f5f5dc', width: 3, height: 3 },
    { front: 'assets/cards/card2-front-1.png', backColor: '#f5f5dc', width: 3, height: 3 },
    { front: 'assets/cards/card3-front.png', backColor: '#fbf9f1', width: 3.49, height: 3.49 },
    { front: 'assets/cards/card4-front.png', backColor: '#ffffff', width: 3.82, height: 3.82 },
    { front: 'assets/cards/card5-front.png', backColor: '#ffcb87', width: 4.03, height: 5.73 }
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






