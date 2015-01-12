var obj : GameObject; // GameObject型
var script : OSCReceiver; //ScriptB型(スクリプト名が型名になる)
var OSCvalueEx0 : float = 0;
var OSCvalueEx2 : float = 0;
var OSCvalueButtonA : float = 0;
var OSCvalueButton1 : float = 0;
var OSCvalueButton2 : float = 0;
var OSCvalueButtonUp : float = 0;
var OSCvalueButtonDown : float = 0;
var OSCvalueButtonLeft : float = 0;
var OSCvalueButtonRight : float = 0;
var OSCvalueButtonPlus : float = 0;
var OSCvalueButtonMinus : float = 0;
var tempOSC : float = 0;

var DRTrigger : boolean;

var PauseTrigger : boolean = false;
var warningtm:GameObject;

var LButtonTrigger : boolean;
var RButtonTrigger : boolean;
var LButtonSignal : GameObject;
var RButtonSignal : GameObject;
var tempLButtonTrigger : boolean;
var tempRButtonTrigger : boolean;

var ExitTrigger0 : boolean = false;
var ExitTrigger1 : boolean = false;

var handbrakeTrigger : boolean = false; //for OSC

var speedtext:GameObject;
var speedtm:TextMesh;
var speedfloat: float = 0;

var Drivetm:Renderer;
var Reversetm:Renderer;

private var wheelRadius : float = 0.4;
var suspensionRange : float = 0.1;
var suspensionDamper : float = 50;
var suspensionSpringFront : float = 18500;
var suspensionSpringRear : float = 9000;

public var brakeLights : Material;

var dragMultiplier : Vector3 = new Vector3(2, 5, 1);

var throttle : float = 0; 
private var steer : float = 0;
private var handbrake : boolean = false;

var centerOfMass : Transform;

var frontWheels : Transform[];
var rearWheels : Transform[];

private var wheels : Wheel[];
wheels = new Wheel[frontWheels.Length + rearWheels.Length];
var wheelCount : float;

private var wfc : WheelFrictionCurve;

var topSpeed : float = 210;
var numberOfGears : int = 5;

var maximumTurn : int = 15;
var minimumTurn : int = 10;

var resetTime : float = 5.0;
private var resetTimer : float = 0.0;

private var engineForceValues : float[];
private var gearSpeeds : float[];

private var currentGear : int;
private var currentEnginePower : float = 0.0;

private var handbrakeXDragFactor : float = 0.5;
private var initialDragMultiplierX : float = 10.0;
private var handbrakeTime : float = 0.0;
private var handbrakeTimer : float = 1.0;

private var skidmarks : Skidmarks = null;
private var skidSmoke : ParticleEmitter = null;
var skidmarkTime : float[];

private var sound : SoundController = null;
sound = transform.GetComponent(SoundController);

private var canSteer : boolean;
private var canDrive : boolean;

var errorFlag : boolean = false;
var score : int = 100;

class Wheel
{
    var collider : WheelCollider;
    var wheelGraphic : Transform;
    var tireGraphic : Transform;
    var driveWheel : boolean = false;
    var steerWheel : boolean = false;
    var lastSkidmark : int = -1;
    var lastEmitPosition : Vector3 = Vector3.zero;
    var lastEmitTime : float = Time.time;
    var wheelVelo : Vector3 = Vector3.zero;
    var groundSpeed : Vector3 = Vector3.zero;
}

function Start()
{   
    SetupOSC();
    
    // Measuring 1 - 60
    accelerationTimer = Time.time;
    
    SetupWheelColliders();
    
    SetupCenterOfMass();
    
    topSpeed = Convert_Miles_Per_Hour_To_Meters_Per_Second(topSpeed);
    
    SetupGears();
    
    SetUpSkidmarks();
    
    initialDragMultiplierX = dragMultiplier.x;
    
    SetupSpeedMeter();
    
    SetupLRButtonSignal();
}

function Update()
{       

    var relativeVelocity : Vector3 = transform.InverseTransformDirection(rigidbody.velocity);
    GetInput();
    
    if(LButtonTrigger)
    {
        if(relativeVelocity.x > 0.5)
        {
            tempLButtonTrigger = true;
        }
        if(tempLButtonTrigger && relativeVelocity.x < 0.1)
        {
            LButtonTrigger = false;
            tempLButtonTrigger = false;
        }
    }
    else
    {
        tempLButtonTrigger = false;
    }
    
    if(RButtonTrigger)
    {
        if(relativeVelocity.x < -0.5)
        {
            tempRButtonTrigger = true;
        }
        if(tempRButtonTrigger && relativeVelocity.x > -0.1)
        {
            RButtonTrigger = false;
            tempRButtonTrigger = false;
        }
    }
    else
    {
        tempRButtonTrigger = false;
    }
        
        
    if(!DRTrigger)
    {
        throttle = (-1) * throttle; 
    }
    Drivetm.enabled = DRTrigger;
    Reversetm.enabled = !DRTrigger;

    
    Check_If_Car_Is_Flipped();
    
    UpdateWheelGraphics(relativeVelocity);
    
    UpdateGear(relativeVelocity);
    
    ShowSpeedMeter(relativeVelocity);
    
    Check_Exit();
    
    if(handbrake)
    {
        if(speedfloat < 7 && speedfloat > 1)
        {
            throttle = -1;
        }
        else
        {
            throttle = 0;
            currentEnginePower = 10;
        }   
    }
    
    if(PauseTrigger)
    {
    	HideError();
    }
    CheckGames();
    
    LButtonSignal.renderer.enabled = LButtonTrigger;
    RButtonSignal.renderer.enabled = RButtonTrigger;
    LButtonSignal.GetComponent("BlinkerForDirection").enabled = LButtonTrigger;
    LButtonSignal.GetComponent("AudioSource").mute = !LButtonTrigger;
    RButtonSignal.GetComponent("BlinkerForDirection").enabled = RButtonTrigger;
    RButtonSignal.GetComponent("AudioSource").mute = !RButtonTrigger;
}

function FixedUpdate()
{   
    // The rigidbody velocity is always given in world space, but in order to work in local space of the car model we need to transform it first.
    var relativeVelocity : Vector3 = transform.InverseTransformDirection(rigidbody.velocity);
    
    CalculateState();   
    
    UpdateFriction(relativeVelocity);
    
    UpdateDrag(relativeVelocity);
    
    CalculateEnginePower(relativeVelocity);
    
    ApplyThrottle(canDrive, relativeVelocity);
    
    ApplySteering(canSteer, relativeVelocity);
}

/**************************************************/
/* Functions called from Start()                  */
/**************************************************/

function SetupOSC()
{
    obj = GameObject.Find("OSC");
    script = obj.GetComponent(OSCReceiver);
}

function SetupWheelColliders()
{
    SetupWheelFrictionCurve();
        
    var wheelCount : int = 0;
    
    for (var t : Transform in frontWheels)
    {
        wheels[wheelCount] = SetupWheel(t, true);
        wheelCount++;
    }
    
    for (var t : Transform in rearWheels)
    {
        wheels[wheelCount] = SetupWheel(t, false);
        wheelCount++;
    }
}

function SetupWheelFrictionCurve()
{
    wfc = new WheelFrictionCurve();
    wfc.extremumSlip = 1;
    wfc.extremumValue = 50;
    wfc.asymptoteSlip = 2;
    wfc.asymptoteValue = 25;
    wfc.stiffness = 1;
}

function SetupWheel(wheelTransform : Transform, isFrontWheel : boolean)
{
    var go : GameObject = new GameObject(wheelTransform.name + " Collider");
    go.transform.position = wheelTransform.position;
    go.transform.parent = transform;
    go.transform.rotation = wheelTransform.rotation;
        
    var wc : WheelCollider = go.AddComponent(typeof(WheelCollider)) as WheelCollider;
    wc.suspensionDistance = suspensionRange;
    var js : JointSpring = wc.suspensionSpring;
    
    if (isFrontWheel)
        js.spring = suspensionSpringFront;
    else
        js.spring = suspensionSpringRear;
        
    js.damper = suspensionDamper;
    wc.suspensionSpring = js;
        
    wheel = new Wheel(); 
    wheel.collider = wc;
    wc.sidewaysFriction = wfc;
    wheel.wheelGraphic = wheelTransform;
    wheel.tireGraphic = wheelTransform.GetComponentsInChildren(Transform)[1];
    
    wheelRadius = wheel.tireGraphic.renderer.bounds.size.y / 2; 
    wheel.collider.radius = wheelRadius;
    
    if (isFrontWheel)
    {
        wheel.steerWheel = true;
        
        go = new GameObject(wheelTransform.name + " Steer Column");
        go.transform.position = wheelTransform.position;
        go.transform.rotation = wheelTransform.rotation;
        go.transform.parent = transform;
        wheelTransform.parent = go.transform;
    }
    else
        wheel.driveWheel = true;
        
    return wheel;
}

function SetupCenterOfMass()
{
    if(centerOfMass != null)
        rigidbody.centerOfMass = centerOfMass.localPosition;
}

function SetupGears()
{
    DRTrigger = true;   // true : D, false : R
    
    engineForceValues = new float[numberOfGears];
    gearSpeeds = new float[numberOfGears];
    
    var tempTopSpeed : float = topSpeed;
        
    for(var i = 0; i < numberOfGears; i++)
    {
        if(i > 0)
//          gearSpeeds[i] = tempTopSpeed / 4 + gearSpeeds[i-1];
            gearSpeeds[i] = tempTopSpeed / 9 + gearSpeeds[i-1] / 9;
        else
            gearSpeeds[i] = tempTopSpeed / 9;
        tempTopSpeed -= tempTopSpeed / 9;
        
    }
    
    var engineFactor : float = topSpeed / gearSpeeds[gearSpeeds.Length - 1];
    
    for(i = 0; i < numberOfGears; i++)
    {
        var maxLinearDrag : float = gearSpeeds[i] * gearSpeeds[i];// * dragMultiplier.z;
        engineForceValues[i] = maxLinearDrag * engineFactor;
        }
    
}

function SetUpSkidmarks()
{
    if(FindObjectOfType(Skidmarks))
    {
        skidmarks = FindObjectOfType(Skidmarks);
        skidSmoke = skidmarks.GetComponentInChildren(ParticleEmitter);
    }
    else
        Debug.Log("No skidmarks object found. Skidmarks will not be drawn");
        
    skidmarkTime = new float[4];
    for (var f : float in skidmarkTime)
        f = 0.0;
}

function SetupSpeedMeter()
{
    speedtext = GameObject.Find("Speed");
    speedtm = speedtext.GetComponent("TextMesh");
    Drivetm = GameObject.Find("DriveMesh").renderer;
    Reversetm = GameObject.Find("ReverseMesh").renderer;
    warningtm = GameObject.Find("WarningText");
}

function SetupLRButtonSignal()
{
    LButtonSignal = GameObject.Find("LeftButton");
    RButtonSignal = GameObject.Find("RightButton");
    LButtonTrigger = false;
    RButtonTrigger = false;
    tempLButtonTrigger = false;
    tempRButtonTrigger = false;

}


/**************************************************/
/* Functions called from Update()                 */
/**************************************************/

function GetInput()
{
//  GetOSC();
    throttle = Input.GetAxis("Vertical");
    steer = Input.GetAxis("Horizontal");
    PauseTrigger = Input.GetKey("1");
    
    steer = steer / 2;
    if(throttle < 0.0)
        brakeLights.SetFloat("_Intensity", Mathf.Abs(throttle));
    else
        brakeLights.SetFloat("_Intensity", 0.0);
    
    CheckHandbrake();
}

function GetOSC()
{
    OSCvalueEx0 = script.Ex0;
    OSCvalueEx2 = script.Ex2;
    OSCvalueButtonA = script.ButtonA;
    OSCvalueButton1 = script.Button1;
    OSCvalueButton2 = script.Button2;
    OSCvalueButtonUp = script.ButtonUp;
    OSCvalueButtonDown = script.ButtonDown;
    OSCvalueButtonLeft = script.ButtonLeft;
    OSCvalueButtonRight = script.ButtonRight;
    OSCvalueButtonPlus = script.ButtonPlus;
    OSCvalueButtonMinus = script.ButtonMinus;

//  steer = Mathf.Sqrt(OSCvalueEx0*OSCvalueEx0+OSCvalueEx2*OSCvalueEx2);
    tempOSC = OSCvalueEx0;
    OSCvalueEx2 = Mathf.Abs(OSCvalueEx2 - 0.5);
    OSCvalueEx0 = Mathf.Abs(OSCvalueEx0 - 0.5);
    steer = 1 - 0.125 * Mathf.Atan2(OSCvalueEx2, OSCvalueEx0) / 0.19625;
    
    if(tempOSC < 0.5)
    {
        steer = (-1)*steer; 
    }
    if(OSCvalueButtonA > 0) 
    {
        throttle = OSCvalueButtonA;
    }
    else
    {
        throttle = 0;
    }
    if(OSCvalueButton1 > 0)
    {
        PauseTrigger = true;
    }
    else
    {
        PauseTrigger = false;
    }
    if(OSCvalueButton2 > 0)
    {
        handbrakeTrigger = true;
    }
    else
    {
        handbrakeTrigger = false;
    }
    if(OSCvalueButtonLeft > 0) 
    {
        DRTrigger = false;  
    }
    if(OSCvalueButtonRight > 0) 
    {
        DRTrigger = true;   
    }
    if(OSCvalueButtonUp > 0) 
    {
        LButtonTrigger = !LButtonTrigger;   
    }
    if(OSCvalueButtonDown > 0) 
    {
        RButtonTrigger = !RButtonTrigger;   
    }
    if(OSCvalueButtonPlus > 0) 
    {
        ExitTrigger0 = true;    
    }
    if(OSCvalueButtonMinus > 0) 
    {
        ExitTrigger1 = true;    
    }
}

function CheckHandbrake()
{
    if(Input.GetKey("space"))
//  if(handbrakeTrigger)
    {
        if(!handbrake)
        {
            handbrake = true;
            handbrakeTime = Time.time;
            dragMultiplier.x = initialDragMultiplierX * handbrakeXDragFactor;
        }
    }
    else if(handbrake)
    {
        handbrake = false;
        StartCoroutine(StopHandbraking(Mathf.Min(5, Time.time - handbrakeTime)));
    }
}

function StopHandbraking(seconds : float)
{
    var diff : float = initialDragMultiplierX - dragMultiplier.x;
    handbrakeTimer = 1;
    
    // Get the x value of the dragMultiplier back to its initial value in the specified time.
    while(dragMultiplier.x < initialDragMultiplierX && !handbrake)
    {
        dragMultiplier.x += diff * (Time.deltaTime / seconds);
        handbrakeTimer -= Time.deltaTime / seconds;
        yield;
    }
    
    dragMultiplier.x = initialDragMultiplierX;
    handbrakeTimer = 0;
}

function Check_If_Car_Is_Flipped()
{
    if(transform.localEulerAngles.z > 80 && transform.localEulerAngles.z < 280)
        resetTimer += Time.deltaTime;
    else
        resetTimer = 0;
    
    if(resetTimer > resetTime)
        FlipCar();
}

function FlipCar()
{
    transform.rotation = Quaternion.LookRotation(transform.forward);
    transform.position += Vector3.up * 0.5;
    rigidbody.velocity = Vector3.zero;
    rigidbody.angularVelocity = Vector3.zero;
    resetTimer = 0;
    currentEnginePower = 0;
}

function UpdateWheelGraphics(relativeVelocity : Vector3)
{
    wheelCount = -1;
    
    for(var w : Wheel in wheels)
    {
        wheelCount++;
        var wheel : WheelCollider = w.collider;
        var wh : WheelHit = new WheelHit();
        
        // First we get the velocity at the point where the wheel meets the ground, if the wheel is touching the ground
        if(wheel.GetGroundHit(wh))
        {
            w.wheelGraphic.localPosition = wheel.transform.up * (wheelRadius + wheel.transform.InverseTransformPoint(wh.point).y);
            w.wheelVelo = rigidbody.GetPointVelocity(wh.point);
            w.groundSpeed = w.wheelGraphic.InverseTransformDirection(w.wheelVelo);
            
            // Code to handle skidmark drawing. Not covered in the tutorial
            if(skidmarks)
            {
                if(skidmarkTime[wheelCount] < 0.02 && w.lastSkidmark != -1)
                {
                    skidmarkTime[wheelCount] += Time.deltaTime;
                }
                else
                {
                    var dt : float = skidmarkTime[wheelCount] == 0.0 ? Time.deltaTime : skidmarkTime[wheelCount];
                    skidmarkTime[wheelCount] = 0.0;

                    var handbrakeSkidding : float = handbrake && w.driveWheel ? w.wheelVelo.magnitude * 0.3 : 0;
                    var skidGroundSpeed = Mathf.Abs(w.groundSpeed.x) - 15;
                    if(skidGroundSpeed > 0 || handbrakeSkidding > 0)
                    {
                        var staticVel : Vector3 = transform.TransformDirection(skidSmoke.localVelocity) + skidSmoke.worldVelocity;
                        if(w.lastSkidmark != -1)
                        {
                            var emission : float = UnityEngine.Random.Range(skidSmoke.minEmission, skidSmoke.maxEmission);
                            var lastParticleCount : float = w.lastEmitTime * emission;
                            var currentParticleCount : float = Time.time * emission;
                            var noOfParticles : int = Mathf.CeilToInt(currentParticleCount) - Mathf.CeilToInt(lastParticleCount);
                            var lastParticle : int = Mathf.CeilToInt(lastParticleCount);
                            
                            for(var i = 0; i <= noOfParticles; i++)
                            {
                                var particleTime : float = Mathf.InverseLerp(lastParticleCount, currentParticleCount, lastParticle + i);
                                skidSmoke.Emit( Vector3.Lerp(w.lastEmitPosition, wh.point, particleTime) + new Vector3(Random.Range(-0.1, 0.1), Random.Range(-0.1, 0.1), Random.Range(-0.1, 0.1)), staticVel + (w.wheelVelo * 0.05), Random.Range(skidSmoke.minSize, skidSmoke.maxSize) * Mathf.Clamp(skidGroundSpeed * 0.1,0.5,1), Random.Range(skidSmoke.minEnergy, skidSmoke.maxEnergy), Color.white);
                            }
                        }
                        else
                        {
                            skidSmoke.Emit( wh.point + new Vector3(Random.Range(-0.1, 0.1), Random.Range(-0.1, 0.1), Random.Range(-0.1, 0.1)), staticVel + (w.wheelVelo * 0.05), Random.Range(skidSmoke.minSize, skidSmoke.maxSize) * Mathf.Clamp(skidGroundSpeed * 0.1,0.5,1), Random.Range(skidSmoke.minEnergy, skidSmoke.maxEnergy), Color.white);
                        }
                    
                        w.lastEmitPosition = wh.point;
                        w.lastEmitTime = Time.time;
                    
                        w.lastSkidmark = skidmarks.AddSkidMark(wh.point + rigidbody.velocity * dt, wh.normal, (skidGroundSpeed * 0.1 + handbrakeSkidding) * Mathf.Clamp01(wh.force / wheel.suspensionSpring.spring), w.lastSkidmark);
                        sound.Skid(true, Mathf.Clamp01(skidGroundSpeed * 0.1));
                    }
                    else
                    {
                        w.lastSkidmark = -1;
                        sound.Skid(false, 0);
                    }
                }
            }
        }
        else
        {
            // If the wheel is not touching the ground we set the position of the wheel graphics to
            // the wheel's transform position + the range of the suspension.
            w.wheelGraphic.position = wheel.transform.position + (-wheel.transform.up * suspensionRange);
            if(w.steerWheel)
                w.wheelVelo *= 0.9;
            else
                w.wheelVelo *= 0.9 * (1 - throttle);
            
            if(skidmarks)
            {
                w.lastSkidmark = -1;
                sound.Skid(false, 0);
            }
        }
        // If the wheel is a steer wheel we apply two rotations:
        // *Rotation around the Steer Column (visualizes the steer direction)
        // *Rotation that visualizes the speed
        if(w.steerWheel)
        {
            var ea : Vector3 = w.wheelGraphic.parent.localEulerAngles;
            ea.y = steer * maximumTurn;
            w.wheelGraphic.parent.localEulerAngles = ea;
            w.tireGraphic.Rotate(Vector3.right * (w.groundSpeed.z / wheelRadius) * Time.deltaTime * Mathf.Rad2Deg);
        }
        else if(!handbrake && w.driveWheel)
        {
            // If the wheel is a drive wheel it only gets the rotation that visualizes speed.
            // If we are hand braking we don't rotate it.
            w.tireGraphic.Rotate(Vector3.right * (w.groundSpeed.z / wheelRadius) * Time.deltaTime * Mathf.Rad2Deg);
        }
    }
}

function UpdateGear(relativeVelocity : Vector3)
{
    currentGear = 0;
    for(var i = 0; i < numberOfGears - 1; i++)
    {
        if(relativeVelocity.z > gearSpeeds[i])
            currentGear = i + 1;
    }
}

function ShowSpeedMeter(relativeVelocity : Vector3)
{
    speedfloat = relativeVelocity.z * 3.6;
    if(speedfloat < 3)
    {
        speedtm.text = "0";
    }
    else
    {
        speedtm.text = speedfloat.ToString("f0");
    }
}

function Check_Exit()
{
    if(ExitTrigger0 && ExitTrigger1)
    {
        gameObject.GetComponent("AudioSource").enabled = true;
        Application.LoadLevel("title");
    }
}

/**************************************************/
/* Functions called from FixedUpdate()            */
/**************************************************/

function UpdateDrag(relativeVelocity : Vector3)
{
    var relativeDrag : Vector3 = new Vector3(   -relativeVelocity.x * Mathf.Abs(relativeVelocity.x), 
                                                -relativeVelocity.y * Mathf.Abs(relativeVelocity.y), 
                                                -relativeVelocity.z * Mathf.Abs(relativeVelocity.z) );

    var drag = Vector3.Scale(dragMultiplier, relativeDrag);

    if(initialDragMultiplierX > dragMultiplier.x) // Handbrake code
    {           
//      drag.x /= (relativeVelocity.magnitude / (topSpeed / ( 1 + 2 * handbrakeXDragFactor ) ) );
//      drag.z /= (1 + Mathf.Abs(Vector3.Dot(rigidbody.velocity.normalized, transform.forward)));
        drag.x /= 0.05*(relativeVelocity.magnitude / (topSpeed / ( 1 + 2 * handbrakeXDragFactor ) ) );
        drag.z /= 0.05*(1 + Mathf.Abs(Vector3.Dot(rigidbody.velocity.normalized, transform.forward)));
        drag += rigidbody.velocity * Mathf.Clamp01(rigidbody.velocity.magnitude / topSpeed);
    }
    else // No handbrake
    {
        drag.x *= topSpeed / relativeVelocity.magnitude;
    }
    
    if(Mathf.Abs(relativeVelocity.x) < 5 && !handbrake)
        drag.x = -relativeVelocity.x * dragMultiplier.x;
        

    rigidbody.AddForce(transform.TransformDirection(drag) * rigidbody.mass * Time.deltaTime);
}

function UpdateFriction(relativeVelocity : Vector3)
{
    var sqrVel : float = relativeVelocity.x * relativeVelocity.x;
    
    // Add extra sideways friction based on the car's turning velocity to avoid slipping
    wfc.extremumValue = Mathf.Clamp(300 - sqrVel, 0, 300);
    wfc.asymptoteValue = Mathf.Clamp(150 - (sqrVel / 2), 0, 150);
        
    for(var w : Wheel in wheels)
    {
        w.collider.sidewaysFriction = wfc;
        w.collider.forwardFriction = wfc;
    }
}

function CalculateEnginePower(relativeVelocity : Vector3)
{
    if(throttle == 0)
    {
        currentEnginePower -= Time.deltaTime * 50;
    }
    else if( HaveTheSameSign(relativeVelocity.z, throttle) )
    {
        normPower = (currentEnginePower / engineForceValues[engineForceValues.Length - 1]) * 2;
        currentEnginePower += Time.deltaTime * 100 * EvaluateNormPower(normPower);
    }
    else
    {
        currentEnginePower -= Time.deltaTime * 200;
    }
    currentEnginePower = Mathf.Clamp(currentEnginePower, 0, engineForceValues[currentGear]);
//  if(currentGear == 0)
//      currentEnginePower = Mathf.Clamp(currentEnginePower, 0, engineForceValues[0]);
//  else
//      currentEnginePower = Mathf.Clamp(currentEnginePower, engineForceValues[currentGear - 1], engineForceValues[currentGear]);
}

function CalculateState()
{
    canDrive = false;
    canSteer = false;
    
    for(var w : Wheel in wheels)
    {
        if(w.collider.isGrounded)
        {
            if(w.steerWheel)
                canSteer = true;
            if(w.driveWheel)
                canDrive = true;
        }
    }
}

function ApplyThrottle(canDrive : boolean, relativeVelocity : Vector3)
{
    if(canDrive)
    {
        var throttleForce : float = 0;
        var brakeForce : float = 0;
        
        if (HaveTheSameSign(relativeVelocity.z, throttle))
        {
            if (!handbrake)
                throttleForce = Mathf.Sign(throttle) * currentEnginePower * rigidbody.mass ;
        }
        else
            brakeForce = Mathf.Sign(throttle) * engineForceValues[0] * rigidbody.mass ; // braking
            
        rigidbody.AddForce(transform.forward * Time.deltaTime * (throttleForce + brakeForce));
    }
}

function ApplySteering(canSteer : boolean, relativeVelocity : Vector3)
{
    if(canSteer)
    {
        var turnRadius : float = 3.0 / Mathf.Sin((90 - (steer * 30)) * Mathf.Deg2Rad);
        var minMaxTurn : float = EvaluateSpeedToTurn(rigidbody.velocity.magnitude);
        var turnSpeed : float = Mathf.Clamp(relativeVelocity.z / turnRadius, -minMaxTurn / 10, minMaxTurn / 10);
        
        transform.RotateAround( transform.position + transform.right * turnRadius * steer, 
                                transform.up, 
                                turnSpeed * Mathf.Rad2Deg * Time.deltaTime * steer);
        
        var debugStartPoint = transform.position + transform.right * turnRadius * steer;
        var debugEndPoint = debugStartPoint + Vector3.up * 5;
        
        Debug.DrawLine(debugStartPoint, debugEndPoint, Color.red);
        
        if(initialDragMultiplierX > dragMultiplier.x) // Handbrake
        {
            var rotationDirection : float = Mathf.Sign(steer); // rotationDirection is -1 or 1 by default, depending on steering
            if(steer == 0)
            {
                if(rigidbody.angularVelocity.y < 1) // If we are not steering and we are handbraking and not rotating fast, we apply a random rotationDirection
                    rotationDirection = Random.Range(-1.0, 1.0);
                else
                    rotationDirection = rigidbody.angularVelocity.y; // If we are rotating fast we are applying that rotation to the car
            }
            // -- Finally we apply this rotation around a point between the cars front wheels.
            transform.RotateAround( transform.TransformPoint( ( frontWheels[0].localPosition + frontWheels[1].localPosition) * 0.5), 
                                                                transform.up, 
                                                                rigidbody.velocity.magnitude * Mathf.Clamp01(1 - rigidbody.velocity.magnitude / topSpeed) * rotationDirection * Time.deltaTime * 2);
        }
    }
}

/**************************************************/
/* Functions called for Function CheckGames()      */
/**************************************************/

function CheckGames()   // speedover and emergency brake
{
     if(speedfloat > 70 && !errorFlag)
     {
     	errorFlag = true;
     	score -= 10;
        ShowError("WARNING " + "\r\n" + "You control the car "  + "\r\n" +  "with overspeed");
     }
}

function OnTriggerEnter(other : Collider)
{
    if(other.gameObject.tag == "Judge"  && !errorFlag)    // traffic rule
    {
        switch(other.gameObject.name)
        {
            case "SignStop" : 
                if(speedfloat > 20)
                {
                	errorFlag = true;
                	score -= 10;
                    ShowError("WARNING " + "\r\n" + "You need to" + "\r\n" + "stop temporarily");
                }
                break;
        }
    }
    else if(other.gameObject.tag == "signal_collider"  && !errorFlag)  // signal
    {
         if(speedfloat > 20)
        {
        	errorFlag = true;
        	score -= 10;
            ShowError("WARNING " + "\r\n" + "You need to" + "\r\n" + "check signal");
        }
    }
    else if(other.gameObject.tag == "Announce")
    {
        other.gameObject.GetComponent("AudioSource").enabled = true;
    }
}

function OnTriggerStay(other : Collider)
{
    if(other.gameObject.tag == "Judge"  && !errorFlag)     //traffic rule and when finishing
    {
        switch(other.gameObject.name)
        {
            case "Sign40" : 
                if(speedfloat > 50)
                {
                	errorFlag = true;
                	score -= 10;
                    ShowError("WARNING " + "\r\n" + "You need to" + "\r\n" + "keep speed" + "\r\n" + "because of traffic signal");
                }
                break;
            case "9fin" : 
                if(speedfloat < 7)
                {
                	errorFlag = true;
                	other.gameObject.GetComponent("AudioSource").enabled = true;
                    ShowResult("Your score is"  + "\r\n" + score + "/100"+ "\r\n" + "Press + and - button" + "\r\n" + "to Exit" );
                }
                break;
            case "practicefin" : 
                if(speedfloat < 7)
                {
                	errorFlag = true;
                	other.gameObject.GetComponent("AudioSource").enabled = true;
                    ShowResult("");
                }
                break;
        }
    }
}

function OnCollisionEnter(other : Collision)    // accident
{
    switch(other.gameObject.tag)
    {
        case "WalkRoad" : 
        	errorFlag = true;
        	score -= 20;
            ShowError("WARNING " + "\r\n" + "You cannot drive"+ "\r\n" + "on the walkroad");
            break;
        case "AI" :
        	errorFlag = true; 
        	score -= 40;
            ShowError(" OH MY GOD...");
            break;
        case "AIPeople" : 
        	errorFlag = true;
        	score -= 40;
            ShowError(" OH MY GOD..." );
            break;
    }
}

function ShowError(message)
{
    GameObject.Find("WarningBack").GetComponent("AudioSource").enabled = true;
	warningtm.GetComponent("TextMesh").text = message;
	Invoke("TimeStop", 0.3);
}

function ShowResult(message)
{
	warningtm.GetComponent("TextMesh").text = message;
	Invoke("TimeStop", 0.3);
}

function TimeStop(){
	rigidbody.velocity = Vector3.zero;
	GameObject.Find("WarningBack").renderer.enabled = true;
	warningtm.renderer.enabled = true;
	Time.timeScale = 0.0f;
}

function HideError()
{
    errorFlag = false;
	warningtm.renderer.enabled = false;
	GameObject.Find("WarningBack").renderer.enabled = false;
	GameObject.Find("WarningBack").GetComponent("AudioSource").enabled = false;
	Time.timeScale = 1.0f;
}

/**************************************************/
/*               Utility Functions                */
/**************************************************/

function Convert_Miles_Per_Hour_To_Meters_Per_Second(value : float) : float
{
    return value * 0.44704;
}

function Convert_Meters_Per_Second_To_Miles_Per_Hour(value : float) : float
{
    return value * 2.23693629;  
}

function HaveTheSameSign(first : float, second : float) : boolean
{
    if (Mathf.Sign(first) == Mathf.Sign(second))
        return true;
    else
        return false;
}

function EvaluateSpeedToTurn(speed : float)
{
    if(speed > topSpeed / 2)
        return minimumTurn;
    
    var speedIndex : float = 1 - (speed / (topSpeed / 2));
    return minimumTurn + speedIndex * (maximumTurn - minimumTurn);
}

function EvaluateNormPower(normPower : float)
{
    if(normPower < 1)
        return 10 - normPower * 9;
    else
        return 1.9 - normPower * 0.9;
}

function GetGearState()
{
    var relativeVelocity : Vector3 = transform.InverseTransformDirection(rigidbody.velocity);
    var lowLimit : float = (currentGear == 0 ? 0 : gearSpeeds[currentGear-1]);
    return (relativeVelocity.z - lowLimit) / (gearSpeeds[currentGear - lowLimit]) * (1 - currentGear * 0.1) + currentGear * 0.1;
}