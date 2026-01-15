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
      this.isAccordion = config.isAccordion || false;
      this.faces = config.faces || null;  // For accordion cards
      this.frontTexturePath = config.frontTexturePath || (config.front);
      this.backColor = config.backColor || null;
      this.backTexturePath = config.backTexturePath || (config.back) || null;
      this.hasThickness = config.hasThickness || false;
      this.edgeColor = config.edgeColor || null;  // For layered wavy edges
      this.thickness = 0.05;
      
      // State
      this.isFrontFacing = true;
      this.isLoaded = false;
      this.accordionOpen = false;  // For accordion cards
      this.accordionAnimating = false;  // Track if accordion is animating
      this.accordionAnimProgress = 0;  // 0 = closed, 1 = open
      this.accordionAnimating = false;  // Track if accordion is animating
      this.accordionAnimProgress = 0;  // 0 = closed, 1 = open
      this.accordionAnimating = false;  // Track if accordion is animating
      this.accordionAnimProgress = 0;  // 0 = closed, 1 = open
      
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
      this.accordionFaces = [];  // For accordion cards
      
      // Animation settings
      this.animationSpeed = 0.06;
      this.flipSpeed = 0.03;  // Slower flip rotation
      this.baseScale = 1;  // Base scale before pinch zoom
      this.pinchOffsetX = 0;  // Pinch zoom position offset
      this.pinchOffsetY = 0;
    }
    
    load(textureLoader, maxAnisotropy = 16) {
      if (this.isAccordion) {
        return this.loadAccordion(textureLoader, maxAnisotropy);
      }
      
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
              
              // Enable anisotropic filtering for sharper textures at angles (use GPU max)
              frontTexture.anisotropy = maxAnisotropy;
              frontTexture.minFilter = THREE.LinearMipmapLinearFilter;
              frontTexture.magFilter = THREE.LinearFilter;
              frontTexture.generateMipmaps = true;
              
              if (backTexture) {
                backTexture.anisotropy = maxAnisotropy;
                backTexture.minFilter = THREE.LinearMipmapLinearFilter;
                backTexture.magFilter = THREE.LinearFilter;
                backTexture.generateMipmaps = true;
              }
              
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
              
              // Add layered edge effect for cards with wavy/transparent edges (no backColor defined)
              if (this.hasThickness && !this.backColor && this.edgeColor) {
                this.addLayeredEdges(frontTexture);
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
    
    addLayeredEdges(frontTexture) {
      // Create multiple layered planes between front and back to simulate thickness
      // These use the front texture's alpha to maintain the wavy edge
      const geometry = new THREE.PlaneGeometry(this.width, this.height);
      const numLayers = 4;
      
      for (let i = 0; i < numLayers; i++) {
        // Calculate z position between front and back
        const t = (i + 1) / (numLayers + 1);
        const z = this.thickness / 2 - t * this.thickness;
        
        // Create edge layer with the edge color, using front texture alpha as mask
        const layerMaterial = new THREE.MeshStandardMaterial({
          color: this.edgeColor,
          map: frontTexture,  // Use for alpha mask
          transparent: true,
          alphaTest: 0.5,
          depthWrite: true
        });
        
        const layer = new THREE.Mesh(geometry, layerMaterial);
        layer.position.z = z;
        layer.castShadow = true;
        this.group.add(layer);
      }
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
    
    loadAccordion(textureLoader, maxAnisotropy) {
      return new Promise(async (resolve, reject) => {
        console.log('Loading accordion card', this.index, 'with', this.faces.length, 'faces');
        
        // Each face is the full width of the card
        const geometry = new THREE.PlaneGeometry(this.width, this.height);
        
        try {
          // Load all faces
          for (let i = 0; i < this.faces.length; i++) {
            const faceConfig = this.faces[i];
            const faceGroup = new THREE.Group();
            
            // Load front texture
            const frontTexture = await new Promise((res, rej) => {
              textureLoader.load(faceConfig.front, res, undefined, rej);
            });
            
            frontTexture.anisotropy = maxAnisotropy;
            frontTexture.minFilter = THREE.LinearMipmapLinearFilter;
            frontTexture.magFilter = THREE.LinearFilter;
            frontTexture.generateMipmaps = true;
            
            const frontMaterial = new THREE.MeshStandardMaterial({
              map: frontTexture,
              transparent: true,
              alphaTest: 0.5,
              depthWrite: true
            });
            
            const frontMesh = new THREE.Mesh(geometry, frontMaterial);
            frontMesh.castShadow = true;
            frontMesh.receiveShadow = true;
            frontMesh.position.z = this.thickness / 2;
            faceGroup.add(frontMesh);
            
            // Load or create back
            let backMaterial;
            if (faceConfig.back) {
              const backTexture = await new Promise((res, rej) => {
                textureLoader.load(faceConfig.back, res, undefined, rej);
              });
              backTexture.anisotropy = maxAnisotropy;
              backMaterial = new THREE.MeshStandardMaterial({
                map: backTexture,
                transparent: true,
                alphaTest: 0.5,
                depthWrite: true
              });
            } else {
              const backTexture = this.createSolidColorTexture(faceConfig.backColor);
              backMaterial = new THREE.MeshStandardMaterial({
                map: backTexture,
                transparent: true,
                alphaTest: 0.5,
                depthWrite: true
              });
            }
            
            const backMesh = new THREE.Mesh(geometry, backMaterial);
            backMesh.castShadow = true;
            backMesh.receiveShadow = true;
            backMesh.rotation.y = Math.PI;
            backMesh.position.z = -this.thickness / 2;
            faceGroup.add(backMesh);
            
            // Z-fold accordion: when closed, faces stack with alternating front/back visible
            // Higher z = closer to camera, so reverse the order to put face 0 on top
            // Face positioning for closed accordion state
            if (i === 0) {
              // First face - on top, front facing forward
              faceGroup.position.x = 0;
              faceGroup.position.z = (5 - i) * 0.001; // Reverse z-order
              faceGroup.rotation.y = 0; // Front visible
            } else if (i === 1) {
              // Second face - stacked below, back facing forward
              faceGroup.position.x = 0;
              faceGroup.position.z = (5 - i) * 0.001;
              faceGroup.rotation.y = Math.PI; // Back visible
            } else if (i === 2) {
              // Third face - front facing forward
              faceGroup.position.x = 0;
              faceGroup.position.z = (5 - i) * 0.001;
              faceGroup.rotation.y = 0; // Front visible
            } else if (i === 3) {
              // Fourth face - back facing forward
              faceGroup.position.x = 0;
              faceGroup.position.z = (5 - i) * 0.001;
              faceGroup.rotation.y = Math.PI; // Back visible
            } else if (i === 4) {
              // Fifth face - front facing forward
              faceGroup.position.x = 0;
              faceGroup.position.z = (5 - i) * 0.001;
              faceGroup.rotation.y = 0; // Front visible
            } else if (i === 5) {
              // Sixth face - back facing forward
              faceGroup.position.x = 0;
              faceGroup.position.z = (5 - i) * 0.001;
              faceGroup.rotation.y = Math.PI; // Back visible
            }
            
            faceGroup.userData.faceIndex = i;
            faceGroup.userData.targetRotation = 0;
            
            this.accordionFaces.push(faceGroup);
            this.group.add(faceGroup); // All faces added directly to main group
          }
          
          this.isLoaded = true;
          console.log('Accordion card', this.index, 'loaded with', this.accordionFaces.length, 'faces');
          resolve(this);
        } catch (error) {
          console.error('Failed to load accordion card', this.index, ':', error);
          reject(error);
        }
      });
    }
    
    flip() {
      this.isFrontFacing = !this.isFrontFacing;
      this.targetRotationY = this.isFrontFacing ? 0 : Math.PI;
    }

    openAccordion() {
      if (!this.isAccordion || this.accordionOpen) return;
      this.accordionOpen = true;
      this.accordionAnimating = true;
    }

    closeAccordion() {
      if (!this.isAccordion || !this.accordionOpen) return;
      this.accordionOpen = false;
      this.accordionAnimating = true;
    }
    
    setPosition(x, y, z) {
      this.targetPosition.set(x, y, z);
    }
    
    setScale(scale) {
      this.baseScale = scale;  // Store base scale for pinch zoom
      this.targetScale.set(scale, scale, scale);
    }
    
    applyPinchZoom(zoomMultiplier, pinchCenterX, pinchCenterY) {
      const zoomedScale = (this.baseScale || 1) * zoomMultiplier;
      this.targetScale.set(zoomedScale, zoomedScale, zoomedScale);
      
      // Apply position offset toward pinch center
      // Convert pinch center to world offset
      const zoomOffset = zoomMultiplier - 1;
      const offsetX = -pinchCenterX * zoomOffset * 3;  // Scale factor for world units
      const offsetY = -pinchCenterY * zoomOffset * 3;
      this.pinchOffsetX = offsetX;
      this.pinchOffsetY = offsetY;
    }
    
    resetPinchOffset() {
      this.pinchOffsetX = 0;
      this.pinchOffsetY = 0;
    }
    
    setHoverTilt(mouseX, mouseY) {
      this.targetRotationX = mouseY * 0.5;
      this.hoverRotationY = mouseX * 0.5;
    }
    
    update() {
      if (!this.isLoaded) return;
      
      // Smooth position animation with pinch offset
      const targetWithOffset = this.targetPosition.clone();
      targetWithOffset.x += this.pinchOffsetX || 0;
      targetWithOffset.y += this.pinchOffsetY || 0;
      this.group.position.lerp(targetWithOffset, this.animationSpeed);
      
      // Smooth scale animation
      this.group.scale.lerp(this.targetScale, this.animationSpeed);
      
      // Smooth rotation animation
      // Combine flip rotation (targetRotationY) with hover rotation (hoverRotationY)
      const totalTargetY = this.targetRotationY + this.hoverRotationY;
      this.group.rotation.y += (totalTargetY - this.group.rotation.y) * this.flipSpeed;  // Slower flip
      this.group.rotation.x += (this.targetRotationX - this.group.rotation.x) * this.animationSpeed;
      
      // Animate accordion if needed
      if (this.accordionAnimating && this.accordionFaces.length > 0) {
        const targetProgress = this.accordionOpen ? 1 : 0;
        const animSpeed = 0.1; // Animation speed
        this.accordionAnimProgress += (targetProgress - this.accordionAnimProgress) * animSpeed;
        
        // Stop animating when close enough
        if (Math.abs(targetProgress - this.accordionAnimProgress) < 0.01) {
          this.accordionAnimProgress = targetProgress;
          this.accordionAnimating = false;
        }
        
        // Apply accordion positions based on progress
        const tiltAngle = 0.15;
        const spacing = this.width * Math.cos(tiltAngle) * 0.98;
        const totalWidth = spacing * (this.accordionFaces.length - 1);
        const startX = -totalWidth / 2;
        
        this.accordionFaces.forEach((faceGroup, i) => {
          // Calculate positions and rotations for closed (Z-fold) state
          const closedX = 0;
          const closedZ = (5 - i) * 0.001;
          // In closed state: alternate front/back stacked
          const closedRotY = i % 2 === 0 ? 0 : Math.PI;
          
          // Calculate positions and rotations for open state
          const openX = startX + i * spacing;
          const openZ = 0;
          // In open state: all face forward with slight tilt
          const openRotY = i % 2 === 0 ? -tiltAngle : tiltAngle;
          
          // Use easing for smoother accordion unfold
          const progress = this.accordionAnimProgress;
          const eased = progress * progress * (3 - 2 * progress); // Smoothstep easing
          
          // Position spreads linearly but with easing
          faceGroup.position.x = closedX + (openX - closedX) * eased;
          faceGroup.position.z = closedZ + (openZ - closedZ) * eased;
          
          // Rotation needs special handling for accordion effect
          // When closing: rotate from slight tilt to π for odd faces, 0 for even
          // When opening: rotate from π/0 to slight tilt
          let currentRotY = closedRotY + (openRotY - closedRotY) * eased;
          
          // Normalize rotation to avoid long spin
          while (currentRotY > Math.PI) currentRotY -= 2 * Math.PI;
          while (currentRotY < -Math.PI) currentRotY += 2 * Math.PI;
          
          faceGroup.rotation.y = currentRotY;
        });
      }
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
      // Tighter spacing so cards barely overlap (about 60% of average card width)
      const horizontalSpacing = 1.8;
      this.baseStartX = -(cards.length - 1) * horizontalSpacing / 2;
      this.horizontalSpacing = horizontalSpacing;
      
      // Swipe scrolling offset
      this.scrollOffset = 0;
      this.targetScrollOffset = 0;
      this.momentum = 0;  // Momentum for coasting after release
      // No buffer on sides
      this.maxScroll = Math.max(0, (cards.length - 1) * horizontalSpacing / 2);
      
      // Initialize animation time
      this.animTime = 0;
      
      for (let i = 0; i < cards.length; i++) {
        const xPos = this.baseStartX + i * horizontalSpacing;
        // Reverse z-order: lower index = higher z (card 1 on top)
        const zPos = (cards.length - 1 - i) * 0.25;
        cards[i].setPosition(xPos, 0, zPos);
        cards[i].setScale(0.8);
        // Reset to front-facing if card was flipped
        if (!cards[i].isFrontFacing) {
          cards[i].flip();
        }
        // Close accordion if open
        if (cards[i].isAccordion && cards[i].accordionOpen) {
          cards[i].closeAccordion();
        }
      }
    }
    
    onSwipe(deltaX) {
      // Adjust scroll based on swipe (inverted: swipe left = scroll left)
      this.targetScrollOffset += deltaX * 0.05;
      // Allow more overscroll for bounce effect (200% beyond max)
      const overscrollMax = this.maxScroll * 4.0;
      this.targetScrollOffset = Math.max(-overscrollMax, Math.min(overscrollMax, this.targetScrollOffset));
    }
    
    applyMomentum(velocity) {
      // Apply momentum based on last swipe velocity
      this.momentum = velocity * 0.3;  // Scale velocity to momentum
    }
    
    update() {
      // Apply momentum (decay over time)
      if (this.momentum) {
        this.targetScrollOffset += this.momentum * 0.05;
        this.momentum *= 0.95;  // Friction - slow down gradually
        if (Math.abs(this.momentum) < 0.1) {
          this.momentum = 0;
        }
      }
      
      // Bounce back if overscrolled
      if (this.targetScrollOffset > this.maxScroll) {
        this.targetScrollOffset += (this.maxScroll - this.targetScrollOffset) * 0.15;
        this.momentum = 0;  // Stop momentum when hitting edge
      } else if (this.targetScrollOffset < -this.maxScroll) {
        this.targetScrollOffset += (-this.maxScroll - this.targetScrollOffset) * 0.15;
        this.momentum = 0;  // Stop momentum when hitting edge
      }
      
      // Smoothly interpolate scroll offset
      this.scrollOffset += (this.targetScrollOffset - this.scrollOffset) * 0.2;
      
      // Slowly animate cards with gentle bobbing motion
      this.animTime += 0.02;
      
      for (let i = 0; i < this.app.cards.length; i++) {
        const card = this.app.cards[i];
        // Each card has a slight phase offset for wave effect
        const phase = i * 0.5;
        const tiltX = Math.sin(this.animTime + phase) * 0.15;
        const tiltY = Math.cos(this.animTime * 0.7 + phase) * 0.1;
        card.setHoverTilt(tiltY, tiltX);
        
        // Bounce up and down with offset, plus horizontal scroll
        // Reverse z-order: lower index = higher z (card 1 on top)
        const xPos = this.baseStartX + i * this.horizontalSpacing + this.scrollOffset;
        const yBounce = Math.sin(this.animTime * 1.2 + phase) * 0.15;
        const zPos = (this.app.cards.length - 1 - i) * 0.25;
        card.setPosition(xPos, yBounce, zPos);
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
    constructor(app) {
      super(app);
      this.accordionScrollOffset = 0;
      this.accordionVelocity = 0;
    }

    enter() {
      console.log('Entering FocusView, selected:', this.app.selectedCardIndex);
      const cards = this.app.cards;
      const selectedIndex = this.app.selectedCardIndex;
      const selectedCard = cards[selectedIndex];
      
      // Reset accordion scroll
      this.accordionScrollOffset = 0;
      this.accordionVelocity = 0;
      
      // Reset accordion scroll
      this.accordionScrollOffset = 0;
      this.accordionVelocity = 0;
      
      // Calculate optimal scale to fill screen with buffer
      const screenAspect = window.innerWidth / window.innerHeight;
      const cardAspect = selectedCard.width / selectedCard.height;
      
      // Calculate how much of the view the card should take up (with buffer)
      const bufferFactor = 0.85;  // 85% of screen, leaving 15% buffer
      
      // Get visible dimensions at z=5 with perspective camera
      const camera = this.app.camera;
      const distance = camera.position.z - 5;  // Distance from camera to card
      const vFov = camera.fov * Math.PI / 180;
      const visibleHeight = 2 * Math.tan(vFov / 2) * distance;
      const visibleWidth = visibleHeight * screenAspect;
      
      // Calculate scale needed to fit width vs height
      const scaleForWidth = (visibleWidth * bufferFactor) / selectedCard.width;
      const scaleForHeight = (visibleHeight * bufferFactor) / selectedCard.height;
      
      // Use the smaller scale so card fits both dimensions
      const optimalScale = Math.min(scaleForWidth, scaleForHeight);
      
      // Position focused card in center
      selectedCard.setPosition(0, 0, 5);
      selectedCard.setScale(optimalScale);
      
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
      // Apply hover tilt to selected card only (if accordion is closed)
      const selectedCard = this.app.cards[this.app.selectedCardIndex];
      if (selectedCard) {
        if (!selectedCard.accordionOpen) {
          selectedCard.setHoverTilt(this.app.mouseX, this.app.mouseY);
        } else {
          selectedCard.setHoverTilt(0, 0);
          
          // Apply accordion scroll offset with bounds and bounce
          if (selectedCard.accordionFaces && selectedCard.accordionFaces.length > 0) {
            const tiltAngle = 0.15;
            const spacing = selectedCard.width * Math.cos(tiltAngle) * 0.98;
            const totalWidth = spacing * (selectedCard.accordionFaces.length - 1);
            const firstFace = selectedCard.accordionFaces[0];
            const lastFace = selectedCard.accordionFaces[selectedCard.accordionFaces.length - 1];
            
            // Calculate bounds - keep first and last faces visible
            const minX = -totalWidth / 2;
            const maxX = totalWidth / 2;
            
            // Apply scroll with bounce (60% overscroll allowed)
            selectedCard.accordionFaces.forEach((face, i) => {
              let newX = face.position.x + this.accordionScrollOffset;
              
              // Bounce effect at edges - allow 0.6x totalWidth as buffer
              const faceTargetX = minX + i * spacing;
              const bounceBuffer = totalWidth * 0.6; // 60% overscroll
              
              // If scrolling beyond bounds, apply resistance
              if (newX > faceTargetX + bounceBuffer) {
                newX = faceTargetX + bounceBuffer + (newX - (faceTargetX + bounceBuffer)) * 0.3;
              } else if (newX < faceTargetX - bounceBuffer) {
                newX = faceTargetX - bounceBuffer + (newX - (faceTargetX - bounceBuffer)) * 0.3;
              }
              
              face.position.x = newX;
            });
          }
          
          // Apply momentum with friction
          this.accordionVelocity *= 0.95;
          if (Math.abs(this.accordionVelocity) > 0.01) {
            this.accordionScrollOffset = 0;
            this.onSwipe(this.accordionVelocity);
          } else {
            this.accordionVelocity = 0;
            
            // Pull back to bounds when stopped
            const tiltAngle = 0.15;
            const spacing = selectedCard.width * Math.cos(tiltAngle) * 0.98;
            const totalWidth = spacing * (selectedCard.accordionFaces.length - 1);
            const minX = -totalWidth / 2;
            
            selectedCard.accordionFaces.forEach((face, i) => {
              const targetX = minX + i * spacing;
              const bounceBuffer = totalWidth * 0.6; // 60% overscroll
              
              // Snap back if beyond bounds (100% bounce strength)
              if (face.position.x > targetX + bounceBuffer) {
                face.position.x += (targetX + bounceBuffer - face.position.x) * 1.0;
              } else if (face.position.x < targetX - bounceBuffer) {
                face.position.x += (targetX - bounceBuffer - face.position.x) * 1.0;
              }
            });
          }
        }
      }
      
      // Keep other cards without tilt (reset each frame)
      for (let i = 0; i < this.app.cards.length; i++) {
        if (i !== this.app.selectedCardIndex) {
          this.app.cards[i].setHoverTilt(0, 0);
        }
      }
    }

    onSwipe(deltaX) {
      const selectedCard = this.app.cards[this.app.selectedCardIndex];
      if (selectedCard && selectedCard.accordionOpen) {
        // No buffer limits - allow free scrolling with bounce
        this.accordionScrollOffset = deltaX * 0.01;
      }
    }

    applyMomentum(velocity) {
      const selectedCard = this.app.cards[this.app.selectedCardIndex];
      if (selectedCard && selectedCard.accordionOpen) {
        this.accordionVelocity = velocity;
      }
    }
    
    onCardClick(cardIndex) {
      console.log('FocusView onCardClick, clicked:', cardIndex, 'selected:', this.app.selectedCardIndex);
      // Only respond if clicking on the focused card
      if (cardIndex === this.app.selectedCardIndex) {
        const selectedCard = this.app.cards[this.app.selectedCardIndex];
        if (selectedCard) {
          console.log('Card is accordion?', selectedCard.isAccordion, 'open?', selectedCard.accordionOpen);
          // If it's an accordion card, toggle open/close
          if (selectedCard.isAccordion) {
            if (selectedCard.accordionOpen) {
              selectedCard.closeAccordion();
            } else {
              selectedCard.openAccordion();
            }
          } else {
            // Regular card - flip it
            selectedCard.flip();
          }
        }
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
      
      this.renderer = new THREE.WebGLRenderer({ 
        canvas: canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));  // Up to 3x for high-DPI displays
      this.renderer.setClearAlpha(1);
      this.renderer.sortObjects = true;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      
      // Store max anisotropy for textures
      this.maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
      console.log('Max anisotropy:', this.maxAnisotropy);
      
      // Add lighting - softer, more ambient
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
      this.scene.add(ambientLight);
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
      directionalLight.position.set(0, 15, 5);  // More directly above
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 4096;
      directionalLight.shadow.mapSize.height = 4096;
      directionalLight.shadow.camera.near = 0.5;
      directionalLight.shadow.camera.far = 50;
      directionalLight.shadow.camera.left = -20;
      directionalLight.shadow.camera.right = 20;
      directionalLight.shadow.camera.top = 20;
      directionalLight.shadow.camera.bottom = -20;
      directionalLight.shadow.radius = 6;  // Softer shadow edges for floor
      directionalLight.shadow.bias = -0.001;
      this.scene.add(directionalLight);
      
      // Transparent background - video shows through
      this.renderer.setClearColor(0x000000, 0);
      
      console.log('Renderer created, size:', window.innerWidth, 'x', window.innerHeight);
      
      // Input state
      this.mouseX = 0;
      this.mouseY = 0;
      this.raycaster = new THREE.Raycaster();
      this.mouse = new THREE.Vector2();
      
      // Pinch zoom state
      this.pinchZoom = 1;
      this.targetPinchZoom = 1;
      this.initialPinchDistance = null;
      this.isPinching = false;
      this.pinchCenterX = 0;  // Normalized pinch center (-1 to 1)
      this.pinchCenterY = 0;
      
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
      const canvas = this.renderer.domElement;
      
      // Detect if device is touch-capable
      this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      // Mouse move (desktop)
      window.addEventListener('mousemove', (e) => {
        this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouseY = (e.clientY / window.innerHeight) * 2 - 1;  // Inverted
      });
      
      // Touch move (mobile) - for tilt effect, swipe scrolling, and pinch zoom
      canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
          // Pinch to zoom
          this.isPinching = true;
          const touch1 = e.touches[0];
          const touch2 = e.touches[1];
          const currentDistance = Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) +
            Math.pow(touch2.clientY - touch1.clientY, 2)
          );
          
          // Track pinch center (normalized -1 to 1)
          const centerX = (touch1.clientX + touch2.clientX) / 2;
          const centerY = (touch1.clientY + touch2.clientY) / 2;
          this.pinchCenterX = (centerX / window.innerWidth) * 2 - 1;
          this.pinchCenterY = -((centerY / window.innerHeight) * 2 - 1);  // Inverted
          
          if (this.initialPinchDistance === null) {
            this.initialPinchDistance = currentDistance;
          } else {
            // Calculate zoom multiplier (clamped between 0.5 and 2.5)
            const scale = currentDistance / this.initialPinchDistance;
            this.targetPinchZoom = Math.max(0.5, Math.min(2.5, scale));
          }
        } else if (e.touches.length === 1 && !this.isPinching) {
          const touch = e.touches[0];
          
          // Calculate swipe delta for spread view scrolling
          if (this.lastTouchX !== undefined) {
            const deltaX = touch.clientX - this.lastTouchX;
            // Track velocity for momentum
            this.swipeVelocity = deltaX;
            // Only swipe in spread view
            if (this.currentView && this.currentView.onSwipe) {
              this.currentView.onSwipe(deltaX);
            }
          }
          this.lastTouchX = touch.clientX;
          
          // Tilt effect (for stack/focus views)
          this.mouseX = (touch.clientX / window.innerWidth) * 2 - 1;
          this.mouseY = (touch.clientY / window.innerHeight) * 2 - 1;  // Inverted
        }
        e.preventDefault();
      }, { passive: false });
      
      // Click (desktop)
      window.addEventListener('click', (e) => this.handleClick(e));
      
      // Touch tap (mobile)
      canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          this.touchStartTime = Date.now();
          this.touchStartX = e.touches[0].clientX;
          this.touchStartY = e.touches[0].clientY;
          this.lastTouchX = e.touches[0].clientX;  // Initialize for swipe tracking
          this.swipeVelocity = 0;  // Reset velocity
        } else if (e.touches.length === 2) {
          // Start pinch - calculate initial distance
          this.isPinching = true;
          const touch1 = e.touches[0];
          const touch2 = e.touches[1];
          this.initialPinchDistance = Math.sqrt(
            Math.pow(touch2.clientX - touch1.clientX, 2) +
            Math.pow(touch2.clientY - touch1.clientY, 2)
          );
        }
        e.preventDefault();  // Prevent zoom/scroll
      }, { passive: false });
      
      canvas.addEventListener('touchend', (e) => {
        const touchDuration = Date.now() - this.touchStartTime;
        const touch = e.changedTouches[0];
        const touchEndX = touch.clientX;
        const touchEndY = touch.clientY;
        
        // Detect tap (short duration, minimal movement)
        const moveDistance = Math.sqrt(
          Math.pow(touchEndX - this.touchStartX, 2) + 
          Math.pow(touchEndY - this.touchStartY, 2)
        );
        
        if (touchDuration < 300 && moveDistance < 20) {
          // Treat as a tap/click
          this.handleTap(touchEndX, touchEndY);
        }
        
        // Apply momentum scrolling
        if (this.currentView && this.currentView.applyMomentum && this.swipeVelocity) {
          this.currentView.applyMomentum(this.swipeVelocity);
        }
        
        // Reset tilt on touch end
        this.mouseX = 0;
        this.mouseY = 0;
        this.lastTouchX = undefined;  // Reset swipe tracking
        this.swipeVelocity = 0;
        
        // Reset pinch zoom
        if (this.isPinching) {
          this.isPinching = false;
          this.initialPinchDistance = null;
          this.targetPinchZoom = 1;  // Return to neutral
        }
        e.preventDefault();
      }, { passive: false });
      
      // Resize
      window.addEventListener('resize', () => {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
      });
    }
    
    handleTap(clientX, clientY) {
      // Same logic as handleClick but with provided coordinates
      this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;
      
      this.raycaster.setFromCamera(this.mouse, this.camera);
      
      const cardGroups = this.cards.map(card => card.group);
      const intersects = this.raycaster.intersectObjects(cardGroups, true);
      
      if (intersects.length > 0) {
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
          hasThickness: config.hasThickness || false,
          edgeColor: config.edgeColor || null,
          isAccordion: config.isAccordion || false,
          faces: config.faces || null
        });
        return card.load(this.textureLoader, this.maxAnisotropy);
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
      // Smoothly interpolate pinch zoom
      this.pinchZoom += (this.targetPinchZoom - this.pinchZoom) * 0.15;
      
      // Apply pinch zoom to all cards if zooming
      if (Math.abs(this.pinchZoom - 1) > 0.01) {
        for (const card of this.cards) {
          card.applyPinchZoom(this.pinchZoom, this.pinchCenterX, this.pinchCenterY);
        }
      } else {
        // Reset pinch offsets when zoom is neutral
        for (const card of this.cards) {
          card.resetPinchOffset();
        }
      }
      
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
    { front: 'assets/cards/card1-front.png', back: 'assets/cards/card1-back.png', width: 3, height: 3, hasThickness: true, edgeColor: '#f5f5dc' },
    { 
      isAccordion: true,
      width: 3,
      height: 3,
      hasThickness: true,
      edgeColor: '#f5f5dc',
      faces: [
        { front: 'assets/cards/card2-front-1.png', back: 'assets/cards/card2-back-1.png' },
        { front: 'assets/cards/card2-front-2.png', back: 'assets/cards/card2-back-2.png' },
        { front: 'assets/cards/card2-front-3.png', backColor: '#ddf3e2' },
        { front: 'assets/cards/card2-front-4.png', backColor: '#ddf3e2' },
        { front: 'assets/cards/card2-front-5.png', backColor: '#ddf3e2' },
        { front: 'assets/cards/card2-front-6.png', backColor: '#ddf3e2' }
      ]
    },
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






